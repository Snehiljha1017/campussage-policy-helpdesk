from __future__ import annotations

from fastapi import APIRouter, HTTPException

from api.schemas import ChatRequest, FeedbackRequest
from database import db
from rag.pipeline import run

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
def chat(req: ChatRequest):
    try:
        return run(req.question, version_id="final", guards_on=True, record=True)
    except Exception as exc:  # LLM outage, etc. - surface a readable error
        raise HTTPException(status_code=502, detail=f"Answer generation failed: {exc}") from exc


@router.get("/history")
def history(limit: int = 20):
    limit = max(1, min(limit, 200))
    return db.rows(
        "SELECT q.id, q.question, q.status, q.confidence, q.mode, q.latency_ms, q.created_at, "
        "(SELECT rating FROM feedback f WHERE f.query_id = q.id ORDER BY f.id DESC LIMIT 1) AS rating "
        "FROM queries q ORDER BY q.id DESC LIMIT ?", (limit,))


@router.get("/history/{query_id}")
def history_item(query_id: int):
    row = db.one("SELECT response_json FROM queries WHERE id=?", (query_id,))
    if not row:
        raise HTTPException(404, "Query not found")
    data = db.loads(row["response_json"], {})
    data["id"] = query_id
    return data


@router.post("/feedback")
def feedback(req: FeedbackRequest):
    if req.rating not in (-1, 1):
        raise HTTPException(422, "rating must be 1 or -1")
    if not db.one("SELECT id FROM queries WHERE id=?", (req.query_id,)):
        raise HTTPException(404, "Query not found")
    fid = db.execute("INSERT INTO feedback (query_id, rating, comment, created_at) VALUES (?,?,?,?)",
                     (req.query_id, req.rating, req.comment, db.now()))
    return {"id": fid, "ok": True}
