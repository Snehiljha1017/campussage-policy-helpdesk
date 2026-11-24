"""Document lifecycle: register -> extract -> chunk -> embed/index -> query."""
from __future__ import annotations

import logging
import shutil
from pathlib import Path

from config import SAMPLE_DOCS_DIR, UPLOAD_DIR
from database import db
from document_processing.chunker import chunk_document
from document_processing.extract import extract_pdf
from rag.vector_store import IndexedChunk, store

log = logging.getLogger("campussage.ingest")

CATEGORIES = [
    "Academic Regulations",
    "Attendance Policy",
    "Examination Policy",
    "Fee Regulations",
    "Hostel Policy",
    "General Notices",
]

SAMPLE_META = {
    "SAMPLE_Attendance_Policy.pdf": ("Attendance Policy (Sample)", "Attendance Policy"),
    "SAMPLE_Examination_Policy.pdf": ("Examination Policy (Sample)", "Examination Policy"),
    "SAMPLE_Fee_Regulations.pdf": ("Fee Regulations (Sample)", "Fee Regulations"),
    "SAMPLE_Hostel_Policy.pdf": ("Hostel Policy (Sample)", "Hostel Policy"),
    "SAMPLE_Academic_Regulations.pdf": ("Academic Regulations (Sample)", "Academic Regulations"),
    "SAMPLE_General_Notice_GN-2026-014.pdf": ("General Notice GN/2026/014 (Sample)", "General Notices"),
}


def _indexed(doc: dict, chunk_rows: list[dict]) -> list[IndexedChunk]:
    return [
        IndexedChunk(
            id=r["id"], document_id=doc["id"], title=doc["title"], category=doc["category"],
            section=r["section"] or "", heading=r["heading"] or "", page=r["page"] or 1, text=r["text"],
        )
        for r in chunk_rows
    ]


def register_document(src: Path, title: str, category: str, is_sample: bool = False) -> int:
    doc_id = db.execute(
        "INSERT INTO documents (title, filename, category, stored_path, is_sample, status, uploaded_at) "
        "VALUES (?, ?, ?, '', ?, 'uploaded', ?)",
        (title, src.name, category, int(is_sample), db.now()),
    )
    dest = UPLOAD_DIR / f"{doc_id}_{src.name}"
    if src.resolve() != dest.resolve():
        shutil.copyfile(src, dest)
    db.execute("UPDATE documents SET stored_path=? WHERE id=?", (str(dest), doc_id))
    return doc_id


def process_document(doc_id: int) -> dict:
    """Extract, chunk and index one document. Safe to call again (re-index)."""
    doc = db.one("SELECT * FROM documents WHERE id=?", (doc_id,))
    if not doc:
        raise KeyError(doc_id)
    db.execute("UPDATE documents SET status='processing', status_detail=NULL WHERE id=?", (doc_id,))
    store.remove_document(doc_id)
    try:
        extracted = extract_pdf(doc["stored_path"])
        chunks = chunk_document(extracted.pages)
        if not chunks:
            raise ValueError("Text was extracted but no chunks could be formed.")
        with db.tx() as conn:
            conn.execute("DELETE FROM chunks WHERE document_id=?", (doc_id,))
            conn.executemany(
                "INSERT INTO chunks (id, document_id, seq, section, heading, page, text) VALUES (?,?,?,?,?,?,?)",
                [(f"{doc_id}:{c.seq}", doc_id, c.seq, c.section, c.heading, c.page, c.text) for c in chunks],
            )
        rows = db.rows("SELECT * FROM chunks WHERE document_id=? ORDER BY seq", (doc_id,))
        store.add(_indexed(doc, rows))
        db.execute(
            "UPDATE documents SET status='indexed', pages=?, chunk_count=?, char_count=?, indexed_at=?, "
            "status_detail=? WHERE id=?",
            (len(extracted.pages), len(chunks), len(extracted.text), db.now(),
             f"Extracted with {extracted.extractor}; indexed with {store.backend}", doc_id),
        )
    except Exception as exc:
        log.exception("Processing failed for document %s", doc_id)
        db.execute("UPDATE documents SET status='failed', status_detail=? WHERE id=?", (str(exc)[:500], doc_id))
    return db.one("SELECT * FROM documents WHERE id=?", (doc_id,))


def delete_document(doc_id: int) -> bool:
    doc = db.one("SELECT * FROM documents WHERE id=?", (doc_id,))
    if not doc:
        return False
    store.remove_document(doc_id)
    db.execute("DELETE FROM chunks WHERE document_id=?", (doc_id,))
    db.execute("DELETE FROM documents WHERE id=?", (doc_id,))
    try:
        Path(doc["stored_path"]).unlink(missing_ok=True)
    except OSError:
        pass
    return True


def load_index_from_db() -> None:
    docs = {d["id"]: d for d in db.rows("SELECT * FROM documents WHERE status='indexed'")}
    rows = db.rows("SELECT * FROM chunks ORDER BY document_id, seq")
    chunks = []
    for r in rows:
        if r["document_id"] in docs:
            chunks.extend(_indexed(docs[r["document_id"]], [r]))
    store.load(chunks)
    log.info("Loaded %d chunks from %d documents", len(chunks), len(docs))


def load_samples(force: bool = False) -> list[dict]:
    """Register and index the bundled SAMPLE documents (skips ones already loaded)."""
    existing = {d["filename"] for d in db.rows("SELECT filename FROM documents WHERE is_sample=1")}
    out = []
    for fname, (title, category) in SAMPLE_META.items():
        path = SAMPLE_DOCS_DIR / fname
        if not path.exists() or (fname in existing and not force):
            continue
        doc_id = register_document(path, title, category, is_sample=True)
        out.append(process_document(doc_id))
    return out
