"""Parse a model's text answer into CampusSage's fields.

Handles the final schema (Answer / Supporting Evidence / Source / Confidence /
Status) and the Milestone 1 baseline schema (Answer / Source clause / Section /
Confidence). Missing fields are reported, not invented: `format_ok` is what the
Format Compliance metric counts.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

STATUSES = ["Answered", "Needs Clarification", "Not Covered", "Conflicting Evidence"]
LABELS = {
    "answer": "answer",
    "supporting evidence": "evidence",
    "evidence": "evidence",
    "source clause": "evidence",
    "source": "source",
    "sources": "source",
    "section": "source",
    "confidence": "confidence",
    "status": "status",
}
LABEL_RE = re.compile(
    r"^\s*(?:[-*#>]+\s*)?\**\s*(" + "|".join(sorted(map(re.escape, LABELS), key=len, reverse=True)) + r")\s*\**\s*[:：]\s*\**",
    re.IGNORECASE | re.MULTILINE,
)
REQUIRED = ["answer", "evidence", "source", "confidence", "status"]


@dataclass
class ParsedOutput:
    answer: str = ""
    evidence: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    confidence: str | None = None
    status: str | None = None
    status_inferred: bool = False
    missing: list[str] = field(default_factory=list)

    @property
    def format_ok(self) -> bool:
        return not self.missing

    def to_dict(self) -> dict:
        return {
            "answer": self.answer, "evidence": self.evidence, "sources": self.sources,
            "confidence": self.confidence, "status": self.status,
            "status_inferred": self.status_inferred, "missing_fields": self.missing,
            "format_ok": self.format_ok,
        }


def _is_none(s: str) -> bool:
    return s.strip().strip('."\'').lower() in {"", "none", "n/a", "na", "not applicable", "-"}


def _split_quotes(block: str) -> list[str]:
    quoted = re.findall(r"[\"“]([^\"”]{8,})[\"”]", block)
    if quoted:
        return [q.strip() for q in quoted]
    lines = [ln.strip(" -*\t") for ln in block.splitlines()]
    return [ln for ln in lines if ln and not _is_none(ln)]


def infer_status(answer: str, evidence: list[str]) -> str:
    a = answer.lower()
    if re.search(r"conflict|contradict|differ(?:ent|s)? (?:value|amount)|two (?:different )?(?:sources|documents)", a):
        return "Conflicting Evidence"
    if re.search(r"(?:does|do) not (?:cover|mention|specify|contain)|not covered|no information|not (?:mentioned|specified)|cannot find|isn't covered", a):
        return "Not Covered"
    if not evidence and a.rstrip().endswith("?"):
        return "Needs Clarification"
    return "Answered"


def parse_output(text: str) -> ParsedOutput:
    out = ParsedOutput()
    fields: dict[str, list[str]] = {}
    matches = list(LABEL_RE.finditer(text or ""))
    for i, m in enumerate(matches):
        key = LABELS[m.group(1).lower()]
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        value = text[m.end():end].strip().strip("*").strip()
        fields.setdefault(key, []).append(value)

    if not matches and text.strip():
        fields["answer"] = [text.strip()]

    out.answer = "\n".join(fields.get("answer", [])).strip()
    ev_blocks = fields.get("evidence", [])
    out.evidence = [q for b in ev_blocks for q in _split_quotes(b)]
    src = [ln.strip(" -*\t") for b in fields.get("source", []) for ln in b.splitlines()]
    out.sources = [s for s in src if s and not _is_none(s)]

    conf = " ".join(fields.get("confidence", []))
    m = re.search(r"\b(high|medium|low)\b", conf, re.IGNORECASE)
    out.confidence = m.group(1).capitalize() if m else None

    st = " ".join(fields.get("status", []))
    out.status = next((s for s in STATUSES if s.lower() in st.lower()), None)

    for key in REQUIRED:
        present = key in fields and (key != "status" or out.status) and (key != "confidence" or out.confidence)
        if not present:
            out.missing.append(key)
    if out.status is None:
        out.status = infer_status(out.answer, out.evidence)
        out.status_inferred = True
    return out
