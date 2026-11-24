"""Retrieval index.

Two backends behind one interface:

* "chroma"  - ChromaDB persistent collection + sentence-transformers embeddings
              (semantic search), combined with a keyword score (hybrid).
* "tfidf"   - local TF-IDF index (word n-grams + character n-grams) built with
              scikit-learn. Works offline with no model download; used
              automatically when ChromaDB / sentence-transformers are missing.

The keyword index is always kept, because exact policy terms ("re-evaluation",
"night-out") matter and short Hinglish queries match better on characters.
"""
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from config import CHROMA_DIR, EMBEDDING_MODEL, VECTOR_BACKEND
from rag.text_utils import expand_query

log = logging.getLogger("campussage.retrieval")


@dataclass
class IndexedChunk:
    id: str
    document_id: int
    title: str
    category: str
    section: str
    heading: str
    page: int
    text: str

    @property
    def index_text(self) -> str:
        # Title + heading are prepended so "late fee" also matches a clause whose
        # body only says "fees paid after the due date".
        return f"{self.title}. {self.heading}. Section {self.section}. {self.text}"


@dataclass
class Hit:
    chunk: IndexedChunk
    score: float
    semantic: float | None = None
    keyword: float | None = None


class _KeywordIndex:
    def __init__(self) -> None:
        self.chunks: list[IndexedChunk] = []
        self.word = self.char = None
        self.Xw = self.Xc = None

    def fit(self, chunks: list[IndexedChunk]) -> None:
        self.chunks = chunks
        if not chunks:
            self.Xw = self.Xc = None
            return
        texts = [expand_query(c.index_text) for c in chunks]
        self.word = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english", min_df=1)
        self.char = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, min_df=1)
        self.Xw = self.word.fit_transform(texts)
        self.Xc = self.char.fit_transform(texts)

    def scores(self, query: str) -> np.ndarray:
        if self.Xw is None:
            return np.zeros(0)
        q = expand_query(query)
        sw = (self.Xw @ self.word.transform([q]).T).toarray().ravel()
        sc = (self.Xc @ self.char.transform([q]).T).toarray().ravel()
        return 0.65 * sw + 0.35 * sc


class VectorStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._kw = _KeywordIndex()
        self._chunks: dict[str, IndexedChunk] = {}
        self._collection = None
        self.backend = "tfidf"
        self.embedding_model: str | None = None
        if VECTOR_BACKEND in {"auto", "chroma"}:
            self._try_chroma()

    # -- setup -------------------------------------------------------------
    def _try_chroma(self) -> None:
        try:
            import chromadb
            from chromadb.utils import embedding_functions

            ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=EMBEDDING_MODEL)
            client = chromadb.PersistentClient(path=str(CHROMA_DIR))
            self._collection = client.get_or_create_collection(
                "policy_chunks", embedding_function=ef, metadata={"hnsw:space": "cosine"}
            )
            self.backend = "chroma"
            self.embedding_model = EMBEDDING_MODEL
            log.info("Retrieval backend: ChromaDB + %s (hybrid with TF-IDF)", EMBEDDING_MODEL)
        except Exception as exc:  # ImportError, model download failure, ...
            if VECTOR_BACKEND == "chroma":
                raise
            log.warning("ChromaDB/sentence-transformers unavailable (%s); using TF-IDF index", exc)
            self._collection = None
            self.backend = "tfidf"

    @property
    def description(self) -> str:
        if self.backend == "chroma":
            return f"Hybrid: ChromaDB + {self.embedding_model} embeddings, plus TF-IDF keywords"
        return "TF-IDF keyword index (word + character n-grams) - fallback mode"

    # -- mutation ----------------------------------------------------------
    def load(self, chunks: list[IndexedChunk]) -> None:
        """Replace the whole in-memory index (called at startup)."""
        with self._lock:
            self._chunks = {c.id: c for c in chunks}
            self._kw.fit(list(self._chunks.values()))
            if self._collection is not None and chunks:
                existing = set(self._collection.get(include=[])["ids"])
                missing = [c for c in chunks if c.id not in existing]
                if missing:
                    self._upsert(missing)

    def _upsert(self, chunks: list[IndexedChunk]) -> None:
        self._collection.upsert(
            ids=[c.id for c in chunks],
            documents=[c.index_text for c in chunks],
            metadatas=[{"document_id": c.document_id, "section": c.section} for c in chunks],
        )

    def add(self, chunks: list[IndexedChunk]) -> None:
        with self._lock:
            for c in chunks:
                self._chunks[c.id] = c
            self._kw.fit(list(self._chunks.values()))
            if self._collection is not None and chunks:
                self._upsert(chunks)

    def remove_document(self, document_id: int) -> None:
        with self._lock:
            ids = [cid for cid, c in self._chunks.items() if c.document_id == document_id]
            for cid in ids:
                self._chunks.pop(cid, None)
            self._kw.fit(list(self._chunks.values()))
            if self._collection is not None and ids:
                self._collection.delete(ids=ids)

    # -- query -------------------------------------------------------------
    def search(self, query: str, k: int = 5) -> list[Hit]:
        with self._lock:
            chunks = self._kw.chunks
            if not chunks:
                return []
            kw = self._kw.scores(query)
            if self._collection is None:
                order = np.argsort(-kw)[:k]
                return [Hit(chunks[i], float(kw[i]), None, float(kw[i])) for i in order]

            n = min(len(chunks), max(k * 3, 10))
            res = self._collection.query(query_texts=[expand_query(query)], n_results=n)
            sem = {cid: 1.0 - float(d) for cid, d in zip(res["ids"][0], res["distances"][0])}
            kw_by_id = {c.id: float(s) for c, s in zip(chunks, kw)}
            kw_max = max(kw_by_id.values()) or 1.0
            candidates = set(sem) | {chunks[i].id for i in np.argsort(-kw)[:n]}
            hits = []
            for cid in candidates:
                s, kws = sem.get(cid, 0.0), kw_by_id.get(cid, 0.0) / kw_max
                hits.append(Hit(self._chunks[cid], 0.7 * s + 0.3 * kws, s, kws))
            hits.sort(key=lambda h: -h.score)
            return hits[:k]

    def stats(self) -> dict:
        return {"backend": self.backend, "description": self.description, "chunks": len(self._chunks)}


store = VectorStore()
