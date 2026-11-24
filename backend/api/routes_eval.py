from __future__ import annotations

import csv
import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse, StreamingResponse

from api.schemas import EvalRunRequest
from database import db
from evaluation.runner import CSV_COLUMNS, load_cases, markdown_table, result_rows, run_in_background

router = APIRouter(prefix="/api/eval", tags=["evaluation"])


@router.get("/cases")
def cases(suite: str = "main"):
    if suite not in {"main", "holdout"}:
        raise HTTPException(422, "suite must be main or holdout")
    return load_cases(suite)


@router.post("/runs")
def start(req: EvalRunRequest):
    running = db.one("SELECT id FROM eval_runs WHERE status='running'")
    if running:
        raise HTTPException(409, f"Run {running['id']} is still in progress.")
    return {"run_id": run_in_background(req.configs, req.repeats, req.suite)}


def _run_dict(r: dict) -> dict:
    r = dict(r)
    r["configs"] = db.loads(r["configs"], [])
    r["summary"] = db.loads(r.pop("summary_json"), None)
    return r


@router.get("/runs")
def runs(limit: int = 20):
    return [_run_dict(r) for r in db.rows("SELECT * FROM eval_runs ORDER BY id DESC LIMIT ?", (limit,))]


@router.get("/runs/latest")
def latest(suite: str = "main"):
    r = db.one("SELECT * FROM eval_runs WHERE status='completed' AND suite=? ORDER BY id DESC LIMIT 1", (suite,))
    if not r:
        return None
    out = _run_dict(r)
    out["results"] = result_rows(r["id"])
    return out


@router.get("/runs/{run_id}")
def run_detail(run_id: int):
    r = db.one("SELECT * FROM eval_runs WHERE id=?", (run_id,))
    if not r:
        raise HTTPException(404, "Run not found")
    out = _run_dict(r)
    out["results"] = result_rows(run_id)
    return out


@router.get("/runs/{run_id}/export.csv")
def export_csv(run_id: int):
    if not db.one("SELECT id FROM eval_runs WHERE id=?", (run_id,)):
        raise HTTPException(404, "Run not found")
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=CSV_COLUMNS)
    w.writeheader()
    w.writerows(result_rows(run_id))
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="campussage_run{run_id}.csv"'})


@router.get("/runs/{run_id}/table.md")
def export_md(run_id: int):
    if not db.one("SELECT id FROM eval_runs WHERE id=?", (run_id,)):
        raise HTTPException(404, "Run not found")
    return PlainTextResponse(markdown_table(run_id), media_type="text/markdown")
