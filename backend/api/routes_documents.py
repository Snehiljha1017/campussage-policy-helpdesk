from __future__ import annotations

import re
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from config import MAX_UPLOAD_MB
from database import db
from document_processing.ingest import (CATEGORIES, delete_document, load_samples, process_document,
                                        register_document)
from rag.text_utils import content_terms, term_coverage
from rag.vector_store import store

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("/categories")
def categories():
    return CATEGORIES


@router.get("")
def list_documents():
    return db.rows("SELECT * FROM documents ORDER BY uploaded_at DESC, id DESC")


@router.get("/search")
def search(q: str, k: int = 8):
    if not q.strip():
        return []
    terms = content_terms(q)
    out = []
    for h in store.search(q, k=max(1, min(k, 25))):
        c = h.chunk
        out.append({"chunk_id": c.id, "document_id": c.document_id, "document": c.title, "category": c.category,
                    "section": c.section, "heading": c.heading, "page": c.page, "text": c.text,
                    "score": round(h.score, 4), "term_coverage": round(term_coverage(terms, c.index_text), 3)})
    return out


@router.post("/load-samples")
def load_sample_documents():
    docs = load_samples()
    return {"loaded": len(docs), "documents": docs}


@router.post("")
async def upload(background: BackgroundTasks, file: UploadFile = File(...), category: str = Form(...),
                 title: str = Form("")):
    if category not in CATEGORIES:
        raise HTTPException(422, f"category must be one of: {', '.join(CATEGORIES)}")
    name = Path(file.filename or "document.pdf").name
    if not name.lower().endswith(".pdf"):
        raise HTTPException(415, "Only PDF files are supported.")
    data = await file.read()
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File is larger than {MAX_UPLOAD_MB} MB.")
    if not data.startswith(b"%PDF"):
        raise HTTPException(415, "The file does not look like a valid PDF.")
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / safe
        p.write_bytes(data)
        doc_id = register_document(p, title.strip() or Path(safe).stem.replace("_", " "), category)
    background.add_task(process_document, doc_id)
    return db.one("SELECT * FROM documents WHERE id=?", (doc_id,))


@router.get("/{doc_id}")
def get_document(doc_id: int):
    doc = db.one("SELECT * FROM documents WHERE id=?", (doc_id,))
    if not doc:
        raise HTTPException(404, "Document not found")
    doc["chunks"] = db.rows("SELECT id, seq, section, heading, page, text FROM chunks WHERE document_id=? ORDER BY seq",
                            (doc_id,))
    return doc


@router.post("/{doc_id}/reindex")
def reindex(doc_id: int):
    if not db.one("SELECT id FROM documents WHERE id=?", (doc_id,)):
        raise HTTPException(404, "Document not found")
    return process_document(doc_id)


@router.delete("/{doc_id}")
def remove(doc_id: int):
    if not delete_document(doc_id):
        raise HTTPException(404, "Document not found")
    return {"ok": True}
