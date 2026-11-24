"""The CampusSage RAG pipeline (the 10-step workflow from the project brief).

    1 receive question         6 build prompt from retrieved excerpts
    2 validate question         7 apply the system prompt (final = V3)
    3 retrieve chunks           8 generate (LLM, or labelled demo mode)
    4 rank chunks               9 validate citations against retrieved text
    5 check evidence           10 return the answer, or decline

`run(question, guards=True)` is the production path used by the chat page.
`run(question, guards=False, version_id="v1")` is the Prompt Lab / evaluation
path: same retrieval and validation, but no deterministic guards, so that the
differences between prompt versions are visible in the results.
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass

import config
from database import db
from prompts.loader import get_version, render
from rag import confidence as conf
from rag import guards, llm
from rag.citation import validate
from rag.demo_answerer import demo_generate
from rag.offices import suggest_office
from rag.output_parser import parse_output
from rag.rerank import rerank
from rag.vector_store import Hit, store


@dataclass
class Step:
    n: int
    name: str
    state: str      # done | skipped | stopped | warning
    detail: str


def _hit_dict(h: Hit) -> dict:
    c = h.chunk
    return {"chunk_id": c.id, "document_id": c.document_id, "document": c.title, "category": c.category,
            "section": c.section, "heading": c.heading, "page": c.page, "text": c.text,
            "score": round(h.score, 4)}


def _mode() -> str:
    return llm.provider()


def run(question: str, *, version_id: str = "final", guards_on: bool = True, top_k: int | None = None,
        record: bool = True, allow_demo: bool = True) -> dict:
    t0 = time.perf_counter()
    top_k = top_k or config.TOP_K
    steps: list[Step] = [Step(1, "Receive question", "done", f"{len(question.strip())} characters")]
    flags: list[str] = []
    mode = _mode()
    version = get_version(version_id)
    result: dict = {
        "question": question, "status": None, "answer": "", "evidence": [], "sources": [],
        "confidence": "Low", "confidence_reason": "", "clarification_question": None,
        "office_suggestion": None, "flags": flags, "retrieved": [], "mode": mode,
        "model": llm.model_name(), "prompt_version": version.id, "guards": guards_on,
        "raw_output": None, "parsed": None, "citation": None, "evidence_check": None,
    }

    def finish(status: str, answer: str, *, reason: str = "", office: str | None = None,
               clarification: str | None = None) -> dict:
        result.update(status=status, answer=answer, confidence_reason=reason or result["confidence_reason"],
                      office_suggestion=office, clarification_question=clarification)
        result["latency_ms"] = int((time.perf_counter() - t0) * 1000)
        result["pipeline"] = [asdict(s) for s in steps]
        if record:
            result["id"] = db.execute(
                "INSERT INTO queries (question, status, confidence, answer, response_json, mode, prompt_version, "
                "latency_ms, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (question, result["status"], result["confidence"], answer, db.dumps(result), mode,
                 version.id, result["latency_ms"], db.now()))
        return result

    # ---- Step 2: validate ---------------------------------------------------
    v = guards.validate_question(question)
    if v.status:
        steps.append(Step(2, "Validate question", "stopped", v.detail))
        return finish(v.status, v.answer, clarification=v.clarification,
                      reason="The question could not be processed as written.")
    working_q = question
    if guards_on:
        inj = guards.injection_flags(question)
        if inj:
            flags.extend(inj)
            working_q = guards.strip_injection(question)
        pd = guards.personal_data_request(question)
        if pd.status:
            flags.extend(pd.flags)
            steps.append(Step(2, "Validate question", "stopped", pd.detail))
            return finish(pd.status, pd.answer, office="Academic Office",
                          reason="CampusSage does not access personal records.")
        amb = guards.ambiguity(working_q)
        if amb.status:
            flags.extend(amb.flags)
            steps.append(Step(2, "Validate question", "stopped", amb.detail))
            return finish(amb.status, amb.answer, clarification=amb.clarification,
                          reason="The question could refer to more than one policy.")
        steps.append(Step(2, "Validate question", "warning" if inj else "done",
                          "instruction-like text ignored" if inj else "clear, specific question"))
    else:
        steps.append(Step(2, "Validate question", "skipped", "guards off (prompt-only evaluation)"))

    # ---- Steps 3-4: retrieve + rank ----------------------------------------
    hits = store.search(working_q, k=max(top_k * 2, 8))
    steps.append(Step(3, "Retrieve chunks", "done" if hits else "warning",
                      f"{len(hits)} candidate chunks via {store.backend}"))
    hits = rerank(working_q, hits)[:top_k]
    result["retrieved"] = [_hit_dict(h) for h in hits]
    steps.append(Step(4, "Rank by relevance", "done",
                      ", ".join(f"§{h.chunk.section} {h.score:.2f}" for h in hits[:3]) or "nothing indexed"))

    # ---- Step 5: evidence check --------------------------------------------
    ev = guards.evidence_check(working_q, hits)
    result["evidence_check"] = {"sufficient": ev.sufficient, "coverage": round(ev.coverage, 3),
                                "top_coverage": round(ev.top_coverage, 3), "top_score": round(ev.top_score, 4),
                                "terms": ev.terms, "reason": ev.reason}
    if guards_on and not ev.sufficient:
        steps.append(Step(5, "Check evidence", "stopped", ev.reason))
        related = hits and ev.top_coverage > 0
        office = suggest_office(working_q, hits[0].chunk.category if related else None)
        if related:
            msg = f"The provided policy documents do not cover this question. Please contact the {office}."
        else:
            msg = ("This question is outside the university policy documents CampusSage has. I can help with "
                   f"attendance, examinations, fees, hostel and academic rules. For anything else, contact the {office}.")
        return finish("Not Covered", msg, office=office, reason="No retrieved clause answers this question.")
    steps.append(Step(5, "Check evidence", "done" if ev.sufficient else "warning", ev.reason))

    # ---- Steps 6-8: prompt + generate ---------------------------------------
    system, user = render(version, working_q if guards_on else question, hits)
    steps.append(Step(6, "Build prompt", "done", f"{len(hits)} excerpts, {len(user)} characters"))
    steps.append(Step(7, "Apply system prompt", "done" if system else "skipped",
                      f"{version.name}" + ("" if system else " (no system prompt)")))
    if mode == "demo":
        if not allow_demo:
            raise llm.LLMUnavailable("No LLM configured")
        raw = demo_generate(working_q, hits)
        steps.append(Step(8, "Generate answer", "warning", "DEMO MODE: extractive, no LLM was called"))
    else:
        gen = llm.generate(system, user, version.temperature)
        raw = gen.text
        steps.append(Step(8, "Generate answer", "done", f"{gen.provider}/{gen.model} via {gen.via}, {gen.latency_ms} ms"))
    result["raw_output"] = raw

    # ---- Step 9: parse + validate citations ---------------------------------
    parsed = parse_output(raw)
    result["parsed"] = parsed.to_dict()
    report = validate(parsed.evidence, parsed.sources, parsed.answer, hits)
    result["citation"] = {
        "verified": report.verified_count, "total": len(report.quotes),
        "unsupported_numbers": report.unsupported_numbers, "cited_sections": report.cited_sections,
    }
    result["evidence"] = [asdict(q) for q in report.quotes]
    result["sources"] = parsed.sources
    status = parsed.status or "Answered"
    if report.unsupported_numbers:
        flags.append("unsupported_number")
    if status in {"Answered", "Conflicting Evidence"} and report.verified_count == 0:
        flags.append("citation_unverified")
    detail = f"{report.verified_count}/{len(report.quotes)} quotations verified"
    if report.unsupported_numbers:
        detail += f"; numbers not in evidence: {', '.join(report.unsupported_numbers)}"
    steps.append(Step(9, "Validate citations", "done" if not (set(flags) & {"unsupported_number", "citation_unverified"}) else "warning", detail))

    # Confidence never exceeds what the evidence supports.
    cited_cov = ev.coverage
    level, reason = conf.assess_confidence(coverage=cited_cov, verified_quotes=report.verified_count,
                                           conflict=status == "Conflicting Evidence", status=status)
    result["model_confidence"] = parsed.confidence
    result["confidence"] = conf.cap(parsed.confidence, level) if mode != "demo" else level
    result["confidence_reason"] = reason

    # ---- Step 10: return or decline ----------------------------------------
    office = None
    if status in {"Not Covered", "Conflicting Evidence"}:
        office = suggest_office(working_q, hits[0].chunk.category if hits else None)
    if guards_on and status == "Answered" and "citation_unverified" in flags:
        steps.append(Step(10, "Return answer", "stopped", "declined: answer could not be grounded in a verified quotation"))
        result["model_answer"] = parsed.answer
        return finish("Not Covered",
                      "I couldn't verify an answer against the policy text, so I won't guess. "
                      f"Please check with the {suggest_office(working_q)}.",
                      office=suggest_office(working_q), reason="Generated answer failed citation validation.")
    steps.append(Step(10, "Return answer", "done", status))
    clar = parsed.answer if status == "Needs Clarification" else None
    return finish(status, parsed.answer, office=office, clarification=clar, reason=reason)
