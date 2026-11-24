"""SQLite storage for documents, chunks, query history, feedback, prompt
versions, lab runs and evaluation results. Uses only the standard library."""
from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from config import DB_PATH

_lock = threading.RLock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    category TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    is_sample INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'uploaded',      -- uploaded | processing | indexed | failed
    status_detail TEXT,
    pages INTEGER DEFAULT 0,
    chunk_count INTEGER DEFAULT 0,
    char_count INTEGER DEFAULT 0,
    uploaded_at TEXT NOT NULL,
    indexed_at TEXT
);
CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,                           -- "<doc_id>:<n>"
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    section TEXT,
    heading TEXT,
    page INTEGER,
    text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
CREATE TABLE IF NOT EXISTS queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    status TEXT,
    confidence TEXT,
    answer TEXT,
    response_json TEXT,
    mode TEXT,
    prompt_version TEXT,
    latency_ms INTEGER,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_id INTEGER REFERENCES queries(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,                       -- +1 helpful, -1 not helpful
    comment TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prompt_versions (
    id TEXT PRIMARY KEY,                           -- e.g. "custom-3"
    name TEXT NOT NULL,
    base_version TEXT,
    system_prompt TEXT NOT NULL,
    user_template TEXT NOT NULL,
    temperature REAL,
    notes TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    version_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    model TEXT,
    raw_output TEXT,
    parsed_json TEXT,
    metrics_json TEXT,
    latency_ms INTEGER,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS eval_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    configs TEXT NOT NULL,                         -- JSON list, e.g. ["system","v1","v2","v3"]
    mode TEXT NOT NULL,                            -- demo | openai | anthropic
    model TEXT,
    repeats INTEGER NOT NULL DEFAULT 1,
    suite TEXT NOT NULL DEFAULT 'main',            -- main | holdout
    status TEXT NOT NULL,                          -- running | completed | failed
    progress INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    summary_json TEXT,
    error TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT
);
CREATE TABLE IF NOT EXISTS eval_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    config TEXT NOT NULL,
    test_id TEXT NOT NULL,
    repeat_idx INTEGER NOT NULL DEFAULT 0,
    test_type TEXT NOT NULL,
    input TEXT NOT NULL,
    expected TEXT NOT NULL,
    actual_status TEXT,
    actual_answer TEXT,
    retrieved_doc TEXT,
    cited_source TEXT,
    citation_correct INTEGER,
    passed INTEGER NOT NULL,
    checks_json TEXT,
    raw_output TEXT,
    latency_ms INTEGER
);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


_conn: sqlite3.Connection | None = None


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = _connect()
        _conn.executescript(SCHEMA)
        _conn.commit()
    return _conn


@contextmanager
def tx() -> Iterator[sqlite3.Connection]:
    """Serialised transaction (SQLite + background evaluation threads)."""
    with _lock:
        conn = get_conn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def rows(sql: str, params: tuple | list = ()) -> list[dict[str, Any]]:
    with _lock:
        return [dict(r) for r in get_conn().execute(sql, params).fetchall()]


def one(sql: str, params: tuple | list = ()) -> dict[str, Any] | None:
    with _lock:
        r = get_conn().execute(sql, params).fetchone()
        return dict(r) if r else None


def execute(sql: str, params: tuple | list = ()) -> int:
    with tx() as conn:
        cur = conn.execute(sql, params)
        return cur.lastrowid


def dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False)


def loads(s: str | None, default: Any = None) -> Any:
    if not s:
        return default
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return default
