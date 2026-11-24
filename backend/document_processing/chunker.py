"""Clause-aware chunking.

Policy documents are organised as numbered clauses ("2.1 Minimum Attendance.
A student must ..."). Chunking on clause boundaries means every chunk carries
its own section number, which is what lets CampusSage cite "Section 2.1" and
lets the citation validator check that citation mechanically.

Documents without numbered clauses fall back to paragraph windows with overlap
and are cited by page ("p.3").
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from config import MAX_CHUNK_CHARS

# "2 Late Payment"  /  "Section 2: Late Payment"  /  "CHAPTER 3 HOSTEL RULES"
HEADING_RE = re.compile(
    r"^(?:section|chapter|part)?\s*(\d{1,2})[.:)]?\s+([A-Z][A-Za-z ,&'()/-]{2,80})$", re.IGNORECASE
)
# "2.1 Late Fee. Fees paid ..."  /  "Clause 2.1: ..."  /  "Rule 2.1.3 ..."
CLAUSE_RE = re.compile(r"^(?:section|clause|rule|para(?:graph)?)?\s*(\d{1,2}(?:\.\d{1,2}){1,3})[.:)]?\s+(.+)$", re.IGNORECASE)


@dataclass
class Chunk:
    seq: int
    section: str        # "2.1", or "p.3" for unstructured text
    heading: str        # parent heading, e.g. "Late Payment"
    page: int           # 1-based
    text: str


def _split_long(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text]
    sentences = re.split(r"(?<=[.;])\s+", text)
    parts, cur = [], ""
    for s in sentences:
        if cur and len(cur) + len(s) + 1 > limit:
            parts.append(cur.strip())
            cur = ""
        cur += " " + s
    if cur.strip():
        parts.append(cur.strip())
    return parts


def _clause_chunks(pages: list[str]) -> list[Chunk]:
    chunks: list[Chunk] = []
    heading = ""
    cur_sec, cur_text, cur_page = None, [], 1

    def flush():
        nonlocal cur_sec, cur_text
        if cur_sec and cur_text:
            body = re.sub(r"\s+", " ", " ".join(cur_text)).strip()
            for part in _split_long(body, MAX_CHUNK_CHARS):
                chunks.append(Chunk(len(chunks), cur_sec, heading, cur_page, part))
        cur_sec, cur_text = None, []

    for page_no, page in enumerate(pages, start=1):
        for raw in page.splitlines():
            line = raw.strip()
            if not line:
                continue
            m_clause = CLAUSE_RE.match(line)
            m_head = None if m_clause else HEADING_RE.match(line)
            if m_clause:
                flush()
                cur_sec, cur_text, cur_page = m_clause.group(1), [m_clause.group(2)], page_no
            elif m_head and len(line) < 90:
                flush()
                heading = m_head.group(2).strip()
            elif cur_sec:
                cur_text.append(line)          # wrapped continuation line
    flush()
    return chunks


def _window_chunks(pages: list[str]) -> list[Chunk]:
    chunks: list[Chunk] = []
    for page_no, page in enumerate(pages, start=1):
        paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", page)]
        buf = ""
        for para in filter(None, paras):
            if buf and len(buf) + len(para) > MAX_CHUNK_CHARS:
                chunks.append(Chunk(len(chunks), f"p.{page_no}", "", page_no, buf.strip()))
                buf = buf[-150:]  # small overlap keeps sentences that straddle a boundary
            buf += " " + para
        if buf.strip():
            chunks.append(Chunk(len(chunks), f"p.{page_no}", "", page_no, buf.strip()))
    return chunks


def chunk_document(pages: list[str]) -> list[Chunk]:
    clause = _clause_chunks(pages)
    total_chars = sum(len(p) for p in pages)
    covered = sum(len(c.text) for c in clause)
    # Use clause chunking only if it captured a substantial share of the text
    # (titles, banners and tables of contents are legitimately left out).
    if clause and covered >= 0.4 * total_chars:
        return clause
    return _window_chunks(pages)
