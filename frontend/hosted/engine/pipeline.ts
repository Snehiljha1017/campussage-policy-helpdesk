// Port of backend/rag/pipeline.py (the 10-step workflow).
import type { ChatResponse, PipelineStep } from "../../src/services/types";
import { index, type Hit } from "./index";
import { generate, llmAvailable, LLMUnavailable, MODEL_LABEL } from "./llm";
import {
  ambiguity, assessConfidence, capConfidence, demoGenerate, evidenceCheck, injectionFlags, parseOutput, personalDataRequest,
  type PromptVersion, renderPrompt, rerank, stripInjection, suggestOffice, validateCitations, validateQuestion,
} from "./logic";

const TOP_K = 5;

const hitDict = (h: Hit) => ({
  chunk_id: h.chunk.id, document_id: h.chunk.document_id, document: h.chunk.title, category: h.chunk.category, section: h.chunk.section,
  heading: h.chunk.heading, page: h.chunk.page, text: h.chunk.text, score: Math.round(h.score * 10000) / 10000,
});

export async function runPipeline(question: string, version: PromptVersion, opts: { guardsOn?: boolean; allowDemo?: boolean } = {}): Promise<ChatResponse> {
  const guardsOn = opts.guardsOn ?? true;
  const allowDemo = opts.allowDemo ?? true;
  const t0 = performance.now();
  const steps: PipelineStep[] = [{ n: 1, name: "Receive question", state: "done", detail: `${question.trim().length} characters` }];
  const flags: string[] = [];
  const llm = await llmAvailable();
  const mode = llm ? "anthropic" : "demo";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = {
    question, status: null, answer: "", evidence: [], sources: [], confidence: "Low", confidence_reason: "", clarification_question: null,
    office_suggestion: null, flags, retrieved: [], mode, model: llm ? MODEL_LABEL : null, prompt_version: version.id, guards: guardsOn,
    raw_output: null, parsed: null, citation: null, evidence_check: null,
  };
  const finish = (status: string, answer: string, o: { reason?: string; office?: string | null; clarification?: string | null } = {}): ChatResponse => {
    Object.assign(r, { status, answer, confidence_reason: o.reason || r.confidence_reason, office_suggestion: o.office ?? null, clarification_question: o.clarification ?? null });
    r.latency_ms = Math.round(performance.now() - t0);
    r.pipeline = steps;
    return r as ChatResponse;
  };

  // Step 2
  const v = validateQuestion(question);
  if (v.status) {
    steps.push({ n: 2, name: "Validate question", state: "stopped", detail: v.detail });
    return finish(v.status, v.answer, { clarification: v.clarification, reason: "The question could not be processed as written." });
  }
  let q = question;
  let inj: string[] = [];
  if (guardsOn) {
    inj = injectionFlags(question);
    if (inj.length) { flags.push(...inj); q = stripInjection(question); }
    const pd = personalDataRequest(question);
    if (pd.status) {
      flags.push(...pd.flags);
      steps.push({ n: 2, name: "Validate question", state: "stopped", detail: pd.detail });
      return finish(pd.status, pd.answer, { office: "Academic Office", reason: "CampusSage does not access personal records." });
    }
    const amb = ambiguity(q);
    if (amb.status) {
      flags.push(...amb.flags);
      steps.push({ n: 2, name: "Validate question", state: "stopped", detail: amb.detail });
      return finish(amb.status, amb.answer, { clarification: amb.clarification, reason: "The question could refer to more than one policy." });
    }
    steps.push({ n: 2, name: "Validate question", state: inj.length ? "warning" : "done", detail: inj.length ? "instruction-like text ignored" : "clear, specific question" });
  } else {
    steps.push({ n: 2, name: "Validate question", state: "skipped", detail: "guards off (prompt-only evaluation)" });
  }

  // Steps 3-4
  let hits = index.search(q, Math.max(TOP_K * 2, 8));
  steps.push({ n: 3, name: "Retrieve chunks", state: hits.length ? "done" : "warning", detail: `${hits.length} candidate chunks via tfidf (in browser)` });
  hits = rerank(q, hits).slice(0, TOP_K);
  r.retrieved = hits.map(hitDict);
  steps.push({ n: 4, name: "Rank by relevance", state: "done", detail: hits.slice(0, 3).map((h) => `§${h.chunk.section} ${h.score.toFixed(2)}`).join(", ") || "nothing indexed" });

  // Step 5
  const ev = evidenceCheck(q, hits);
  r.evidence_check = { ...ev, coverage: Math.round(ev.coverage * 1000) / 1000, top_coverage: Math.round(ev.top_coverage * 1000) / 1000, top_score: Math.round(ev.top_score * 10000) / 10000 };
  if (guardsOn && !ev.sufficient) {
    steps.push({ n: 5, name: "Check evidence", state: "stopped", detail: ev.reason });
    const related = hits.length > 0 && ev.top_coverage > 0;
    const office = suggestOffice(q, related ? hits[0].chunk.category : null);
    const msg = related
      ? `The provided policy documents do not cover this question. Please contact the ${office}.`
      : `This question is outside the university policy documents CampusSage has. I can help with attendance, examinations, fees, hostel and academic rules. For anything else, contact the ${office}.`;
    return finish("Not Covered", msg, { office, reason: "No retrieved clause answers this question." });
  }
  steps.push({ n: 5, name: "Check evidence", state: ev.sufficient ? "done" : "warning", detail: ev.reason });

  // Steps 6-8
  const [system, user] = renderPrompt(version, guardsOn ? q : question, hits);
  steps.push({ n: 6, name: "Build prompt", state: "done", detail: `${hits.length} excerpts, ${user.length} characters` });
  steps.push({ n: 7, name: "Apply system prompt", state: system ? "done" : "skipped", detail: version.name + (system ? "" : " (no system prompt)") });
  let raw: string;
  if (!llm) {
    if (!allowDemo) throw new LLMUnavailable("No LLM available");
    raw = demoGenerate(q, hits);
    steps.push({ n: 8, name: "Generate answer", state: "warning", detail: "DEMO MODE: extractive, no LLM was called" });
  } else {
    const g = await generate(system, user);
    raw = g.text;
    r.model = g.model;
    steps.push({ n: 8, name: "Generate answer", state: "done", detail: `${g.model}, ${g.latency_ms} ms (temperature not settable here)` });
  }
  r.raw_output = raw;

  // Step 9
  const parsed = parseOutput(raw);
  r.parsed = parsed;
  const rep = validateCitations(parsed.evidence, parsed.sources, parsed.answer, hits);
  const verified = rep.quotes.filter((x) => x.verified).length;
  r.citation = { verified, total: rep.quotes.length, unsupported_numbers: rep.unsupported_numbers, cited_sections: rep.cited_sections };
  r.evidence = rep.quotes;
  r.sources = parsed.sources;
  const status = parsed.status ?? "Answered";
  if (rep.unsupported_numbers.length) flags.push("unsupported_number");
  if ((status === "Answered" || status === "Conflicting Evidence") && verified === 0) flags.push("citation_unverified");
  let detail = `${verified}/${rep.quotes.length} quotations verified`;
  if (rep.unsupported_numbers.length) detail += `; numbers not in evidence: ${rep.unsupported_numbers.join(", ")}`;
  steps.push({ n: 9, name: "Validate citations", state: flags.some((f) => f === "unsupported_number" || f === "citation_unverified") ? "warning" : "done", detail });

  const [level, reason] = assessConfidence({ coverage: ev.coverage, verified_quotes: verified, conflict: status === "Conflicting Evidence", status });
  r.model_confidence = parsed.confidence;
  r.confidence = llm ? capConfidence(parsed.confidence, level) : level;
  r.confidence_reason = reason;

  // Step 10
  let office: string | null = null;
  if (status === "Not Covered" || status === "Conflicting Evidence") office = suggestOffice(q, hits.length ? hits[0].chunk.category : null);
  if (guardsOn && status === "Answered" && flags.includes("citation_unverified")) {
    steps.push({ n: 10, name: "Return answer", state: "stopped", detail: "declined: answer could not be grounded in a verified quotation" });
    r.model_answer = parsed.answer;
    const o = suggestOffice(q);
    return finish("Not Covered", `I couldn't verify an answer against the policy text, so I won't guess. Please check with the ${o}.`,
      { office: o, reason: "Generated answer failed citation validation." });
  }
  steps.push({ n: 10, name: "Return answer", state: "done", detail: status });
  return finish(status, parsed.answer, { office, clarification: status === "Needs Clarification" ? parsed.answer : null, reason });
}
