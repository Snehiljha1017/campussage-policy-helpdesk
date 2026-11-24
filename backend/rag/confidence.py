"""Evidence-based confidence (High / Medium / Low).

The model may *claim* a confidence, but CampusSage never shows a confidence
higher than the evidence supports: the final value is the lower of the model's
claim and this evidence-based assessment.
"""
from __future__ import annotations

LEVELS = ["Low", "Medium", "High"]


def assess_confidence(
    *,
    coverage: float,          # share of the question's key terms found in the cited clauses (0-1)
    verified_quotes: int,     # quotations that were found word-for-word in retrieved clauses
    conflict: bool,           # two sources disagree
    status: str,              # Answered | Needs Clarification | Not Covered | Conflicting Evidence
) -> tuple[str, str]:
    """Return (level, one-line reason shown to the student)."""
    if status != "Answered" and status != "Conflicting Evidence":
        return "Low", "No policy clause answers this question directly."
    if verified_quotes == 0:
        return "Low", "The quoted evidence could not be verified against the retrieved policy text."
    if conflict:
        return "Medium", "Two policy sources give different values; confirm with the office named."
    if coverage >= 0.75:
        return "High", "A verified clause covers all key parts of the question."
    if coverage >= 0.5:
        return "Medium", "A verified clause covers most, but not all, parts of the question."
    return "Low", "The verified clause is only partly related to the question."


def cap(model_claim: str | None, evidence_level: str) -> str:
    """Lower of the model's claimed level and the evidence-based level."""
    if model_claim not in LEVELS:
        return evidence_level
    return LEVELS[min(LEVELS.index(model_claim), LEVELS.index(evidence_level))]
