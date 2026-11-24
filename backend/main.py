"""CampusSage API.

Run locally (from this folder):
    uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from api import routes_chat, routes_documents, routes_eval, routes_lab
from database import db
from document_processing.ingest import load_index_from_db, load_samples
from rag import llm
from rag.vector_store import store

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("campussage")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.get_conn()
    # Runs left 'running' by a previous process can never finish.
    db.execute("UPDATE eval_runs SET status='failed', error='API restarted during run' WHERE status='running'")
    load_index_from_db()
    if not db.one("SELECT id FROM documents LIMIT 1"):
        log.info("Empty library: loading the bundled SAMPLE documents")
        load_samples()
    log.info("LLM mode: %s (%s). Retrieval: %s", llm.provider(), llm.model_name(), store.description)
    yield


app = FastAPI(title="CampusSage API", version="1.0.0", lifespan=lifespan,
              description="AI-powered university policy helpdesk (SCSE4041, team Agentic Minds)")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
for r in (routes_chat.router, routes_documents.router, routes_lab.router, routes_eval.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    mode = llm.provider()
    return {
        "status": "ok",
        "llm_mode": mode,
        "demo_mode": mode == "demo",
        "model": llm.model_name(),
        "retrieval": store.stats(),
        "documents": (db.one("SELECT COUNT(*) AS n FROM documents WHERE status='indexed'") or {}).get("n", 0),
    }


@app.get("/api/stats")
def stats():
    by_cat = db.rows("SELECT category, COUNT(*) AS documents, SUM(chunk_count) AS chunks FROM documents "
                     "WHERE status='indexed' GROUP BY category")
    by_status = db.rows("SELECT status, COUNT(*) AS n FROM queries GROUP BY status")
    fb = db.one("SELECT SUM(rating = 1) AS up, SUM(rating = -1) AS down FROM feedback") or {}
    return {
        "documents": (db.one("SELECT COUNT(*) AS n FROM documents") or {}).get("n", 0),
        "queries": (db.one("SELECT COUNT(*) AS n FROM queries") or {}).get("n", 0),
        "categories": by_cat,
        "query_status": by_status,
        "feedback": {"helpful": fb.get("up") or 0, "not_helpful": fb.get("down") or 0},
        "recent_documents": db.rows("SELECT id, title, category, status, uploaded_at, is_sample FROM documents "
                                    "ORDER BY uploaded_at DESC, id DESC LIMIT 5"),
    }


@app.get("/")
def root():
    return {"name": "CampusSage API", "docs": "/docs", "health": "/api/health"}
