"""Lightweight lexical reranker (Step 4 of the workflow).

Retrieval scores alone favour clauses that *mention* the topic. Students
usually want the clause that contains the *answer*, so candidates are
reranked on three signals:

  * retrieval score (normalised to the best candidate)
  * key-term coverage of the question
  * answer-type match: a "how much / kitni" question prefers clauses that
    contain a quantity, a "what time / by when" question prefers clauses
    containing a time or a deadline.
"""
from __future__ import annotations

import re

from rag.text_utils import content_terms, term_coverage
from rag.vector_store import Hit

QUANTITY_Q = re.compile(r"\bhow (?:much|many|long)\b|\bkitn[aie]\b|\bminimum\b|\bmaximum\b|\bpercent|%|\bcost|\bamount\b|\bhow old\b", re.I)
TIME_Q = re.compile(r"\bwhat time\b|\bby when\b|\bkab tak\b|\btimings?\b|\bhours\b|\bwhen (?:do|should|must)\b|\bat night\b", re.I)
DATE_Q = re.compile(r"\bdeadline\b|\blast date\b|\bdue date\b|\bwhen\b|\bkab\b|\bwithin\b", re.I)

HAS_QUANTITY = re.compile(r"\d+\s?%|(?:rs\.?|inr|₹)\s?\d|\b\d+\s+(?:credits?|days?|weeks?|minutes?|semesters?|books?)\b", re.I)
HAS_TIME = re.compile(r"\b\d{1,2}:\d{2}\s?(?:am|pm)?\b", re.I)
HAS_DATE = re.compile(r"\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\bwithin \d+ days\b", re.I)


def answer_type_bonus(question: str, text: str) -> float:
    bonus = 0.0
    if QUANTITY_Q.search(question) and HAS_QUANTITY.search(text):
        bonus = 1.0
    if TIME_Q.search(question) and HAS_TIME.search(text):
        bonus = 1.0
    if DATE_Q.search(question) and HAS_DATE.search(text):
        bonus = max(bonus, 0.7)
    return bonus


def rerank(question: str, hits: list[Hit]) -> list[Hit]:
    if not hits:
        return hits
    terms = content_terms(question)
    best = max(h.score for h in hits) or 1.0
    scored = []
    for h in hits:
        cov = term_coverage(terms, h.chunk.index_text)
        combined = 0.45 * (h.score / best) + 0.40 * cov + 0.15 * answer_type_bonus(question, h.chunk.text)
        scored.append((combined, h))
    scored.sort(key=lambda x: -x[0])
    return [h for _, h in scored]
