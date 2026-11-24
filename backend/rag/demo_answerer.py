"""Local demonstration mode: an extractive answerer used ONLY when no LLM API
key is configured. It never paraphrases and never generates new text about
policy: it selects the best-matching sentence from the retrieved clause and
reports it in CampusSage's output format. Every response it produces is
labelled mode="demo" in the API and in the UI.
"""
from __future__ import annotations

import re

from rag.guards import detect_conflicts
from rag.offices import suggest_office
from rag.text_utils import content_terms, money_in, term_coverage
from rag.vector_store import Hit


def _sentences(text: str) -> list[str]:
    # Split on sentence ends, but not inside "Rs. 500" or "(a)".
    parts = re.split(r"(?<!Rs)(?<!\b[a-z])\.\s+(?=[A-Z])", text)
    out = []
    for p in parts:
        p = p.strip()
        if p and not p.endswith("."):
            p += "."
        out.append(p)
    return [p for p in out if len(p) > 3]


def best_sentence(question: str, text: str) -> str:
    if len(text) <= 350:
        return text.strip()
    terms = content_terms(question)
    sents = _sentences(text)
    return max(sents, key=lambda s: (term_coverage(terms, s), len(s))) if sents else text


def _fmt(answer: str, quotes: list[str], sources: list[str], status: str) -> str:
    ev = "\n".join(f'"{q}"' for q in quotes) or "None"
    src = "\n".join(sources) or "None"
    return (f"Answer:\n{answer}\n\nSupporting Evidence:\n{ev}\n\nSource:\n{src}\n\n"
            f"Confidence:\nLow\n\nStatus:\n{status}")


def demo_generate(question: str, hits: list[Hit]) -> str:
    if not hits:
        office = suggest_office(question)
        return _fmt(f"The provided policy documents do not cover this. Please contact the {office}.", [], [], "Not Covered")

    conflicts = detect_conflicts(question, hits)
    if conflicts:
        a, b = conflicts[0]
        qa = next((s for s in _sentences(a.chunk.text) if money_in(s)), a.chunk.text)
        qb = next((s for s in _sentences(b.chunk.text) if money_in(s)), b.chunk.text)
        office = suggest_office(question, a.chunk.category)
        answer = (f"The policy documents disagree: {a.chunk.title}, Section {a.chunk.section} and "
                  f"{b.chunk.title}, Section {b.chunk.section} state different amounts. "
                  f"Please confirm the applicable rule with the {office}.")
        return _fmt(answer, [qa, qb],
                    [f"{a.chunk.title}, Section {a.chunk.section}", f"{b.chunk.title}, Section {b.chunk.section}"],
                    "Conflicting Evidence")

    top = hits[0].chunk
    quote = best_sentence(question, top.text)
    answer = f"As per {top.title}, Section {top.section}: {quote}"
    return _fmt(answer, [quote], [f"{top.title}, Section {top.section}"], "Answered")
