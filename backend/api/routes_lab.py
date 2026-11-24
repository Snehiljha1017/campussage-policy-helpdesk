"""Prompt Engineering Lab: list/edit prompt versions, preview the exact prompt
sent to the model, and run the same question through several versions."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from api.schemas import CompareRequest, PreviewRequest, PromptCreate
from database import db
from prompts.loader import get_version, list_versions, render, save_custom
from rag import llm
from rag.pipeline import run
from rag.rerank import rerank
from rag.vector_store import store

router = APIRouter(prefix="/api", tags=["prompt lab"])


@router.get("/prompts")
def prompts():
    return [v.to_dict() for v in list_versions(include_final=True)]


@router.get("/prompts/{vid}")
def prompt(vid: str):
    try:
        return get_version(vid).to_dict()
    except KeyError:
        raise HTTPException(404, "Prompt version not found")


@router.post("/prompts")
def create_prompt(req: PromptCreate):
    try:
        return save_custom(req.name, req.system_prompt, req.user_template, req.temperature, req.base_version,
                           req.notes).to_dict()
    except ValueError as exc:
        raise HTTPException(422, str(exc))


@router.delete("/prompts/{vid}")
def delete_prompt(vid: str):
    if not vid.startswith("custom-"):
        raise HTTPException(400, "Built-in versions live in the prompts/ folder and cannot be deleted here.")
    db.execute("DELETE FROM prompt_versions WHERE id=?", (vid,))
    return {"ok": True}


@router.post("/lab/preview")
def preview(req: PreviewRequest):
    try:
        v = get_version(req.version_id)
    except KeyError:
        raise HTTPException(404, "Prompt version not found")
    hits = rerank(req.question, store.search(req.question, k=10))[:5]
    system, user = render(v, req.question, hits)
    return {"version_id": v.id, "system_prompt": system, "user_prompt": user, "temperature": v.temperature}


@router.post("/lab/compare")
def compare(req: CompareRequest):
    if not llm.available():
        return {
            "llm_available": False,
            "message": "No LLM API key is configured, so prompt versions cannot be compared. Set OPENAI_API_KEY "
                       "(or ANTHROPIC_API_KEY) in backend/.env and restart the API. The exact prompts that would "
                       "be sent are shown below.",
            "results": [preview(PreviewRequest(version_id=v, question=req.question)) for v in req.versions],
        }
    results = []
    for vid in req.versions:
        try:
            r = run(req.question, version_id=vid, guards_on=False, record=False, allow_demo=False)
        except KeyError:
            raise HTTPException(404, f"Prompt version {vid} not found")
        except Exception as exc:
            results.append({"version_id": vid, "error": str(exc)})
            continue
        metrics = {
            "format_ok": (r.get("parsed") or {}).get("format_ok"),
            "status": r["status"],
            "quotes_verified": (r.get("citation") or {}).get("verified", 0),
            "quotes_total": (r.get("citation") or {}).get("total", 0),
            "unsupported_numbers": (r.get("citation") or {}).get("unsupported_numbers", []),
            "status_inferred": (r.get("parsed") or {}).get("status_inferred"),
            "missing_fields": (r.get("parsed") or {}).get("missing_fields", []),
        }
        db.execute(
            "INSERT INTO lab_runs (question, version_id, mode, model, raw_output, parsed_json, metrics_json, latency_ms, "
            "created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (req.question, vid, r["mode"], r["model"], r["raw_output"], db.dumps(r.get("parsed")), db.dumps(metrics),
             r["latency_ms"], db.now()))
        results.append({"version_id": vid, "result": r, "metrics": metrics})
    return {"llm_available": True, "results": results}


@router.get("/lab/runs")
def lab_runs(limit: int = 30):
    out = db.rows("SELECT * FROM lab_runs ORDER BY id DESC LIMIT ?", (max(1, min(limit, 200)),))
    for r in out:
        r["metrics"] = db.loads(r.pop("metrics_json"), {})
        r["parsed"] = db.loads(r.pop("parsed_json"), {})
    return out
