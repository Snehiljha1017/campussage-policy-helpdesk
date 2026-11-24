"""Deterministic guards that run around the LLM.

Pre-LLM:  question validation, prompt-injection flagging, third-party personal
          data refusal, ambiguity detection, evidence sufficiency (abstain
          before calling the model when nothing relevant was retrieved).
Post-LLM: see rag/citation.py (quote + section verification).

The conflict detector is used by the no-LLM demo mode; with an LLM, conflict
detection is the job of the V3 prompt (rule 9).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from rag.text_utils import content_terms, money_in, stem, term_coverage, tokens
from rag.vector_store import Hit, store

MAX_QUESTION_CHARS = 1000

INJECTION_PATTERNS = [
    r"ignore (?:all |any |the )?(?:previous|prior|above|earlier) (?:instructions|rules|prompts?)",
    r"disregard (?:the |all |your )?(?:rules|instructions|system prompt)",
    r"you are now\b", r"act as (?:an? )?(?!student)", r"system prompt", r"jailbreak",
    r"pretend (?:that|to)", r"forget (?:your|the) (?:rules|instructions)",
]

PERSONAL_RECORD_TERMS = (
    r"attendance|marks?|grades?|cgpa|sgpa|results?|fee (?:status|dues)|dues|roll (?:no|number)|"
    r"enrol(?:l)?ment (?:no|number)|phone(?: number)?|address|email|room number"
)
PERSONAL_RE = re.compile(
    rf"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)'s\s+(?:{PERSONAL_RECORD_TERMS})\b"
    rf"|\b(?:{PERSONAL_RECORD_TERMS})\s+of\s+(?:student\s+)?([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b"
)

# Words that, on their own, could refer to several different policies. The
# value is a retrieval hint used to find the candidate meanings in the corpus.
AMBIGUOUS_TERMS = {
    "deadline": "last date due date within days apply",
    "date": "last date due date",
    "fee": "fee charge payment",
    "fine": "late fee penalty charge",
    "penalty": "late fee penalty debarred",
    "charge": "fee charge",
    "timing": "time hours AM PM",
    "time": "time hours AM PM",
    "leave": "leave absence break night-out",
    "eligibility": "eligible eligibility",
    "eligible": "eligible eligibility",
    "process": "apply application procedure",
    "procedure": "apply application procedure",
    "form": "apply application",
    "limit": "maximum minimum limit",
    "refund": "refund",
}

KEYWORD_SCORE_FLOOR = 0.08   # TF-IDF scale
SEMANTIC_SCORE_FLOOR = 0.25  # hybrid/cosine scale


@dataclass
class GuardOutcome:
    status: str | None = None              # set => pipeline stops here
    answer: str = ""
    clarification: str | None = None
    flags: list[str] = field(default_factory=list)
    detail: str = ""


def _word_like(tok: str) -> bool:
    if tok.isdigit():
        return True
    if not re.search(r"[aeiouy]", tok):
        return False
    return not re.search(r"[^aeiouy0-9]{5,}", tok)


def validate_question(question: str) -> GuardOutcome:
    q = question.strip()
    if not q:
        return GuardOutcome("Needs Clarification", "Please type a question about a university policy.",
                            detail="empty input")
    if len(q) > MAX_QUESTION_CHARS:
        return GuardOutcome("Needs Clarification",
                            f"Your question is very long. Please shorten it to under {MAX_QUESTION_CHARS} characters.",
                            detail="too long")
    toks = tokens(q)
    if not toks or sum(_word_like(t) for t in toks) / len(toks) < 0.5:
        return GuardOutcome(
            "Needs Clarification",
            "I couldn't understand that. Could you rephrase your question about attendance, examinations, fees, "
            "hostel or academic rules?",
            clarification="Could you rephrase your question?",
            detail="input does not look like words",
        )
    return GuardOutcome(detail="ok")


def injection_flags(question: str) -> list[str]:
    q = question.lower()
    return ["prompt_injection"] if any(re.search(p, q) for p in INJECTION_PATTERNS) else []


def strip_injection(question: str) -> str:
    """Drop the sentence(s) that carry the injected instruction, keep the rest."""
    parts = re.split(r"(?<=[.!?])\s+|\s+and\s+(?=tell|say|state)", question)
    kept = [p for p in parts if not any(re.search(pat, p.lower()) for pat in INJECTION_PATTERNS)]
    return " ".join(kept).strip() or question


def personal_data_request(question: str) -> GuardOutcome:
    if PERSONAL_RE.search(question):
        return GuardOutcome(
            "Not Covered",
            "I can't share or look up information about individual students. CampusSage only reads published "
            "policy documents and has no access to personal records. Students can see their own records on the "
            "student portal.",
            flags=["personal_data_request"],
            detail="question asks for another person's record",
        )
    return GuardOutcome(detail="ok")


def ambiguity(question: str) -> GuardOutcome:
    terms = content_terms(question, expand=False)
    stems = {stem(t) for t in terms}
    amb = [t for t in terms if t in AMBIGUOUS_TERMS or stem(t) in AMBIGUOUS_TERMS]
    specific = [t for t in terms if t not in amb and t not in {"last", "much", "many", "when", "whats"}]
    if not amb or specific or len(stems) > 2:
        return GuardOutcome(detail="ok")
    term = amb[0]
    hits = store.search(AMBIGUOUS_TERMS.get(term, AMBIGUOUS_TERMS.get(stem(term), term)), k=8)
    options, seen = [], set()
    for h in hits:
        label = f"{h.chunk.heading or 'Section ' + h.chunk.section} ({h.chunk.category})"
        if h.score > 0 and label not in seen:
            seen.add(label)
            options.append(label)
        if len(options) == 4:
            break
    if options:
        question_text = f"Which {term} do you mean? For example: " + "; ".join(options) + "."
    else:
        question_text = f"Could you tell me which {term} you are asking about (fees, examinations, attendance or hostel)?"
    return GuardOutcome("Needs Clarification", question_text, clarification=question_text,
                        flags=["ambiguous"], detail=f"'{term}' alone could refer to several policies")


@dataclass
class EvidenceCheck:
    sufficient: bool
    coverage: float
    top_coverage: float
    top_score: float
    terms: list[str]
    reason: str


def evidence_check(question: str, hits: list[Hit]) -> EvidenceCheck:
    terms = content_terms(question) or content_terms(question, drop_generic=False)
    if not hits:
        return EvidenceCheck(False, 0.0, 0.0, 0.0, terms, "no documents indexed")
    top = hits[0]
    floor = SEMANTIC_SCORE_FLOOR if store.backend == "chroma" else KEYWORD_SCORE_FLOOR
    combined = " ".join(h.chunk.index_text for h in hits[:3])
    cov = term_coverage(terms, combined)
    top_cov = term_coverage(terms, top.chunk.index_text)
    if top.score < floor:
        return EvidenceCheck(False, cov, top_cov, top.score, terms, f"top retrieval score {top.score:.2f} below {floor}")
    if cov < 0.5:
        return EvidenceCheck(False, cov, top_cov, top.score, terms,
                             f"retrieved clauses cover only {cov:.0%} of the question's key terms")
    if top_cov < 0.34:
        return EvidenceCheck(False, cov, top_cov, top.score, terms,
                             f"best clause covers only {top_cov:.0%} of the key terms (question may combine topics)")
    return EvidenceCheck(True, cov, top_cov, top.score, terms, f"coverage {cov:.0%}, top score {top.score:.2f}")


def detect_conflicts(question: str, hits: list[Hit]) -> list[tuple[Hit, Hit]]:
    """Two highly-relevant clauses from different documents that state
    different money amounts for the same question."""
    terms = content_terms(question)
    if not hits or not terms:
        return []
    top_score = hits[0].score
    cand = [h for h in hits[:4] if h.score >= 0.6 * top_score and money_in(h.chunk.text)]
    covered = {h.chunk.id: {t for t in terms if term_coverage([t], h.chunk.index_text) == 1.0} for h in cand}
    pairs = []
    for i, a in enumerate(cand):
        for b in cand[i + 1:]:
            if a.chunk.document_id == b.chunk.document_id:
                continue
            ca, cb = covered[a.chunk.id], covered[b.chunk.id]
            if ca != cb or len(ca) / len(terms) < 0.5:
                continue
            if money_in(a.chunk.text).isdisjoint(money_in(b.chunk.text)):
                pairs.append((a, b))
    return pairs
