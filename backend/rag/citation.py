"""Citation validation: is each quotation really in a retrieved clause, and does
the cited section match the clause it came from?"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from rag.text_utils import numbers_in, quote_norm
from rag.vector_store import Hit

SECTION_RE = re.compile(r"(?:section|sec\.?|clause|§)\s*(\d+(?:\.\d+)*)|\b(\d+\.\d+(?:\.\d+)*)\b", re.IGNORECASE)


@dataclass
class VerifiedQuote:
    quote: str
    chunk_id: str | None
    document: str | None
    document_id: int | None
    section: str | None
    heading: str | None
    page: int | None
    category: str | None
    similarity: float
    verified: bool
    section_cited: bool


@dataclass
class CitationReport:
    quotes: list[VerifiedQuote] = field(default_factory=list)
    cited_sections: list[str] = field(default_factory=list)
    unsupported_numbers: list[str] = field(default_factory=list)

    @property
    def verified_count(self) -> int:
        return sum(q.verified for q in self.quotes)

    @property
    def all_verified(self) -> bool:
        return bool(self.quotes) and all(q.verified for q in self.quotes)

    def cited_chunks(self) -> list[VerifiedQuote]:
        return [q for q in self.quotes if q.verified]


def _best_similarity(quote: str, text: str) -> float:
    q, t = quote_norm(quote), quote_norm(text)
    if not q:
        return 0.0
    if q in t:
        return 1.0
    if len(q) > len(t):
        return SequenceMatcher(None, q, t).ratio()
    best, step = 0.0, max(1, len(q) // 4)
    for i in range(0, len(t) - len(q) + 1, step):
        best = max(best, SequenceMatcher(None, q, t[i:i + len(q)]).ratio())
        if best > 0.97:
            break
    return best


def validate(evidence: list[str], sources: list[str], answer: str, hits: list[Hit], threshold: float = 0.9) -> CitationReport:
    report = CitationReport()
    for s in sources:
        for a, b in SECTION_RE.findall(s):
            report.cited_sections.append(a or b)
    cited = set(report.cited_sections)

    for quote in evidence:
        best_hit, best_sim = None, 0.0
        for h in hits:
            sim = _best_similarity(quote, h.chunk.text)
            # Prefer the clause whose section the model actually cited.
            if sim > best_sim + 1e-9 or (abs(sim - best_sim) < 1e-9 and h.chunk.section in cited):
                best_hit, best_sim = h, sim
        ok = best_hit is not None and best_sim >= threshold
        c = best_hit.chunk if best_hit else None
        report.quotes.append(VerifiedQuote(
            quote=quote, chunk_id=c.id if c else None, document=c.title if c else None,
            document_id=c.document_id if c else None, section=c.section if c else None,
            heading=c.heading if c else None, page=c.page if c else None,
            category=c.category if c else None, similarity=round(best_sim, 3), verified=ok,
            section_cited=bool(c and c.section in cited),
        ))

    # Numbers in the answer must appear somewhere in the retrieved evidence.
    evidence_numbers = set()
    for h in hits:
        evidence_numbers |= numbers_in(h.chunk.text) | numbers_in(h.chunk.title)
    answer_wo_refs = SECTION_RE.sub(" ", re.sub(r"\[E\d+\]", " ", answer))
    for n in sorted(numbers_in(answer_wo_refs)):
        if n not in evidence_numbers:
            report.unsupported_numbers.append(n)
    return report
