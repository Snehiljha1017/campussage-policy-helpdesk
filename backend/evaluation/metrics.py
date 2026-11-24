"""Per-test checks and aggregate metrics. Every number shown on the Evaluation
dashboard and in the Prompt Lab is computed here from stored outputs; nothing
is estimated or typed in by hand.

Metric definitions
------------------
pass_rate            tests passed / tests run
status_accuracy      status (Answered / Needs Clarification / Not Covered /
                     Conflicting Evidence) matches the expected status
factual_correctness  among tests with required facts (must_include), the share
                     whose answer + quotations contain every required fact
citation_accuracy    among tests with expected sources, the share whose
                     verified quotations come from the expected clause(s)
hallucination_rate   share of outputs that state policy content not found in
                     the retrieved text: a number absent from the evidence, or
                     an "Answered" status with zero verified quotations
policy_grounding     among outputs with status Answered, the share with at
                     least one quotation verified word-for-word
format_compliance    share of outputs containing all five fields (Answer,
                     Supporting Evidence, Source, Confidence, Status)
consistency          (repeats > 1 only) share of tests whose status and cited
                     sections were identical across all repeats
"""
from __future__ import annotations

import re
from collections import defaultdict


def _text_for_facts(result: dict) -> str:
    quotes = " ".join(e.get("quote", "") for e in result.get("evidence", []))
    return f"{result.get('answer', '')} {quotes}".lower()


def evaluate_case(case: dict, result: dict) -> dict:
    status = result.get("status")
    status_ok = status in case["expected_status"]

    verified = [e for e in result.get("evidence", []) if e.get("verified")]
    cited = {(e.get("category"), e.get("section")) for e in verified}
    expected = {(s["category"], s["section"]) for s in case.get("expected_sources", [])}
    if expected:
        citation_correct = expected <= cited if case.get("require_all_sources") else bool(expected & cited)
    else:
        citation_correct = None

    text = _text_for_facts(result)
    missing_facts = [grp for grp in case.get("must_include", []) if not any(alt.lower() in text for alt in grp)]
    include_ok = not missing_facts
    answer = result.get("answer", "")
    forbidden = [p for p in case.get("must_not_match", []) if re.search(p, answer, re.IGNORECASE)]
    exclude_ok = not forbidden

    citation = result.get("citation") or {}
    unsupported = citation.get("unsupported_numbers", [])
    n_verified = len(verified)
    hallucination = bool(unsupported) or (status == "Answered" and n_verified == 0)

    parsed = result.get("parsed")
    # Responses stopped by a deterministic guard are produced by code in the
    # fixed schema, so they are format-compliant by construction.
    format_ok = parsed["format_ok"] if parsed else True

    passed = status_ok and citation_correct is not False and include_ok and exclude_ok
    reasons = []
    if not status_ok:
        reasons.append(f"status {status!r}, expected {' or '.join(case['expected_status'])}")
    if citation_correct is False:
        reasons.append("expected clause not among verified citations")
    if missing_facts:
        reasons.append("missing fact: " + " / ".join(missing_facts[0]))
    if forbidden:
        reasons.append("forbidden content in answer")
    top = (result.get("retrieved") or [{}])[0]
    return {
        "passed": passed,
        "status_ok": status_ok,
        "citation_correct": citation_correct,
        "include_ok": include_ok,
        "exclude_ok": exclude_ok,
        "has_required_facts": bool(case.get("must_include")),
        "hallucination": hallucination,
        "grounded": n_verified > 0 if status == "Answered" else None,
        "format_ok": format_ok,
        "unsupported_numbers": unsupported,
        "reasons": reasons,
        "retrieved_doc": f"{top.get('document', '-')} §{top.get('section', '-')}" if top else "-",
        "cited_source": "; ".join(f"{e.get('document')} §{e.get('section')}" for e in verified) or "-",
    }


def _ratio(num: int, den: int) -> float | None:
    return round(num / den, 4) if den else None


def summarise(records: list[dict]) -> dict:
    """records: [{config, test_id, test_type, repeat_idx, status, cited, checks}]"""
    by_cfg: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        by_cfg[r["config"]].append(r)
    out = {}
    for cfg, rs in by_cfg.items():
        first = [r for r in rs if r["repeat_idx"] == 0]
        ch = [r["checks"] for r in rs]
        answered = [c for c in ch if c["grounded"] is not None]
        with_facts = [c for c in ch if c["has_required_facts"]]
        with_cites = [c for c in ch if c["citation_correct"] is not None]
        by_type = defaultdict(lambda: {"total": 0, "passed": 0})
        for r in first:
            by_type[r["test_type"]]["total"] += 1
            by_type[r["test_type"]]["passed"] += int(r["checks"]["passed"])
        repeats = max(r["repeat_idx"] for r in rs) + 1
        consistency = None
        if repeats > 1:
            sig: dict[str, set] = defaultdict(set)
            for r in rs:
                sig[r["test_id"]].add((r["status"], tuple(sorted(r["cited"]))))
            consistency = _ratio(sum(len(s) == 1 for s in sig.values()), len(sig))
        out[cfg] = {
            "tests": len(first),
            "outputs": len(rs),
            "repeats": repeats,
            "passed": sum(r["checks"]["passed"] for r in first),
            "failed": sum(not r["checks"]["passed"] for r in first),
            "by_type": dict(by_type),
            "metrics": {
                "pass_rate": _ratio(sum(c["passed"] for c in ch), len(ch)),
                "status_accuracy": _ratio(sum(c["status_ok"] for c in ch), len(ch)),
                "factual_correctness": _ratio(sum(c["include_ok"] for c in with_facts), len(with_facts)),
                "citation_accuracy": _ratio(sum(bool(c["citation_correct"]) for c in with_cites), len(with_cites)),
                "hallucination_rate": _ratio(sum(c["hallucination"] for c in ch), len(ch)),
                "policy_grounding": _ratio(sum(bool(c["grounded"]) for c in answered), len(answered)),
                "format_compliance": _ratio(sum(c["format_ok"] for c in ch), len(ch)),
                "consistency": consistency,
            },
        }
    return out
