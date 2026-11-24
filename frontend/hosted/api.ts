// Hosted build: the same `api` interface as src/services/api.ts, implemented in the browser.
// Retrieval, guards, prompts, citation checks and evaluation run here; Claude (via claude.ai)
// is the LLM when the viewer allows it, otherwise the labelled demo mode is used.
// Data lives in this browser only (localStorage), so each viewer gets their own copy.
import type {
  ChatResponse, CompareResponse, DocumentDetail, DocumentRow, EvalResultRow, EvalRun, EvalRunDetail, Health, HistoryRow, LabRun,
  PromptPreview, PromptVersion as PV, RetrievedChunk, Stats, TestCase,
} from "../src/services/types";
import data from "./data.generated.json";
import { index, type IndexedChunk, RETRIEVAL_DESCRIPTION, indexText } from "./engine/index";
import { getSample, llmAvailable, MODEL_LABEL } from "./engine/llm";
import { chunkDocument, parsePromptFile, type PromptVersion, renderPrompt, rerank, stripBoilerplate } from "./engine/logic";
import { evaluateCase, type RecordRow, summarise, type TestCaseFull } from "./engine/metrics";
import { runPipeline } from "./engine/pipeline";
import { contentTerms, termCoverage } from "./engine/text";

export const API_URL = "in-browser";
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/* ---------------- state (per browser) ---------------- */
interface ChunkRow { id: string; seq: number; section: string; heading: string; page: number; text: string }
interface QueryRow { id: number; question: string; status: string; confidence: string; mode: string; latency_ms: number; created_at: string; response: ChatResponse }
interface State {
  docs: DocumentRow[]; chunks: Record<number, ChunkRow[]>; queries: QueryRow[]; feedback: { query_id: number; rating: number; comment?: string; created_at: string }[];
  prompts: PV[]; labRuns: LabRun[]; runs: EvalRun[]; results: Record<number, EvalResultRow[]>; next: { doc: number; query: number; prompt: number; lab: number; run: number };
}
const KEY = "campussage-hosted-v1";
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function sampleDocs(startId: number): { docs: DocumentRow[]; chunks: Record<number, ChunkRow[]> } {
  const docs: DocumentRow[] = [], chunks: Record<number, ChunkRow[]> = {};
  data.documents.forEach((d, i) => {
    const id = startId + i;
    docs.push({ id, title: d.title, filename: d.filename, category: d.category, is_sample: 1, status: "indexed",
      status_detail: "Sample document; clauses extracted by the CampusSage backend chunker", pages: d.pages, chunk_count: d.chunk_count,
      char_count: d.char_count, uploaded_at: now(), indexed_at: now() });
    chunks[id] = d.chunks.map((c) => ({ id: `${id}:${c.seq}`, ...c }));
  });
  return { docs, chunks };
}

function fresh(): State {
  const s = sampleDocs(1);
  const runs: EvalRun[] = [], results: Record<number, EvalResultRow[]> = {};
  for (const imp of data.imported_runs) {
    const r = imp.run;
    runs.unshift({ id: r.id, configs: r.configs, mode: "demo (backend)", model: r.model, repeats: r.repeats, suite: r.suite as "main" | "holdout",
      status: "completed", progress: imp.results.length, total: imp.results.length, summary: imp.summary as EvalRun["summary"],
      error: `Recorded by the Python backend: ${imp.file}`, started_at: r.started_at, finished_at: r.finished_at });
    results[r.id] = imp.results as EvalResultRow[];
  }
  return { docs: s.docs, chunks: s.chunks, queries: [], feedback: [], prompts: [], labRuns: [], runs, results,
    next: { doc: s.docs.length + 1, query: 1, prompt: 1, lab: 1, run: Math.max(0, ...runs.map((r) => r.id)) + 1 } };
}

let S: State = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch { /* storage unavailable */ }
  return fresh();
})();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* quota or sandbox: keep in memory */ }
}
// A run cannot survive a page reload.
S.runs.forEach((r) => { if (r.status === "running") { r.status = "failed"; r.error = "Page was reloaded during the run"; } });

function rebuildIndex() {
  const chunks: IndexedChunk[] = [];
  for (const d of S.docs) if (d.status === "indexed") for (const c of S.chunks[d.id] ?? [])
    chunks.push({ id: c.id, document_id: d.id, title: d.title, category: d.category, section: c.section, heading: c.heading, page: c.page, text: c.text });
  index.load(chunks);
}
rebuildIndex();

/* ---------------- prompts ---------------- */
const SOURCES = data.prompt_sources as Record<string, string>;
const builtins = (): PromptVersion[] => (["v1", "v2", "v3", "final"] as const).map((v) => parsePromptFile(v, (data.prompts as Record<string, string>)[v], SOURCES[v]));
const allPrompts = (): PromptVersion[] => [...builtins(), ...(S.prompts as PromptVersion[])];
function getVersion(id: string): PromptVersion {
  const v = allPrompts().find((p) => p.id === id);
  if (!v) throw new ApiError(404, "Prompt version not found");
  return v;
}

/* ---------------- pdf ---------------- */
async function extractPdf(buf: ArrayBuffer): Promise<string[]> {
  // @ts-expect-error - bundled ESM build of pdf.js, no types needed here
  const pdfjs = await import("pdfjs-dist/build/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", document.baseURI).href;
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    let s = "";
    for (const it of tc.items as { str?: string; hasEOL?: boolean }[]) { s += it.str ?? ""; if (it.hasEOL) s += "\n"; }
    pages.push(s);
  }
  return pages;
}
async function processDoc(id: number, buf: ArrayBuffer) {
  const d = S.docs.find((x) => x.id === id);
  if (!d) return;
  try {
    const pages = stripBoilerplate(await extractPdf(buf));
    if (!pages.some((p) => p.trim())) throw new Error("No extractable text found. The PDF may be a scanned image; OCR is not supported yet.");
    const chunks = chunkDocument(pages);
    if (!chunks.length) throw new Error("Text was extracted but no chunks could be formed.");
    S.chunks[id] = chunks.map((c) => ({ id: `${id}:${c.seq}`, ...c }));
    Object.assign(d, { status: "indexed", pages: pages.length, chunk_count: chunks.length, char_count: pages.join("\n").length, indexed_at: now(),
      status_detail: "Extracted with pdf.js in your browser; indexed with TF-IDF" });
  } catch (e) {
    Object.assign(d, { status: "failed", status_detail: e instanceof Error ? e.message : String(e) });
  }
  rebuildIndex();
  save();
}

/* ---------------- evaluation ---------------- */
const SUITES = { main: data.test_cases as TestCaseFull[], holdout: data.holdout_cases as TestCaseFull[] };
const truncate = (s: string) => s;

async function executeRun(run: EvalRun, runnable: string[], skipped: Record<string, string>) {
  const cases = SUITES[run.suite];
  const records: RecordRow[] = [];
  const rows: EvalResultRow[] = [];
  S.results[run.id] = rows;
  try {
    for (const cfg of runnable) for (let rep = 0; rep < run.repeats; rep++) for (const c of cases) {
      const res = cfg === "system" ? await runPipeline(c.input, getVersion("final"), { guardsOn: true })
        : await runPipeline(c.input, getVersion(cfg), { guardsOn: false, allowDemo: false });
      const ch = evaluateCase(c, res);
      records.push({ config: cfg, test_id: c.id, test_type: c.type, repeat_idx: rep, status: res.status,
        cited: res.evidence.filter((e) => e.verified).map((e) => `${e.category}:${e.section}`), checks: ch });
      rows.push({ Config: cfg, Repeat: rep + 1, "Test ID": c.id, Input: c.input, Type: c.type, "Expected Output": c.expected_output,
        "Actual Status": res.status, "Actual Output": truncate(res.answer), "Retrieved Document": ch.retrieved_doc, "Cited Source": ch.cited_source,
        "Citation Correct": ch.citation_correct === null ? "n/a" : ch.citation_correct ? "Yes" : "No", "Pass/Fail": ch.passed ? "Pass" : "Fail",
        "Failure Reasons": ch.reasons.join("; ") });
      run.progress++;
      if (run.progress % 3 === 0) save();
      await sleep(0);
    }
    run.summary = { configs: summarise(records), skipped, demo_mode: run.mode === "demo" } as EvalRun["summary"];
    run.status = "completed";
  } catch (e) {
    run.status = "failed";
    run.error = e instanceof Error ? e.message : String(e);
    if (records.length) run.summary = { configs: summarise(records), skipped, demo_mode: run.mode === "demo" } as EvalRun["summary"];
  }
  run.finished_at = now();
  save();
}

export function markdownTable(run: EvalRun, rows: EvalResultRow[]): string {
  const L = [`# Evaluation run ${run.id} - suite: ${run.suite} - mode: ${run.mode}${run.model ? ` (${run.model})` : ""}`, "",
    `Started ${run.started_at}, finished ${run.finished_at ?? "-"}. Repeats: ${run.repeats}. Run in the hosted CampusSage page.`, ""];
  if (run.mode.startsWith("demo")) L.push("> DEMO MODE: no LLM was called.", "");
  for (const [cfg, s] of Object.entries(run.summary?.configs ?? {})) {
    L.push(`## Config \`${cfg}\`: ${s.passed}/${s.tests} passed`, "", "| Metric | Value |", "|---|---|");
    for (const [k, v] of Object.entries(s.metrics)) L.push(`| ${k.replace(/_/g, " ")} | ${v === null ? "n/a" : `${Math.round((v as number) * 100)}%`} |`);
    L.push("", "| Test no. | Input (short) | Type | Expected output | Actual output (short) | Pass / Fail |", "|---|---|---|---|---|---|");
    for (const r of rows.filter((x) => x.Config === cfg && x.Repeat === 1)) {
      const actual = `${r["Actual Status"]}: ${(r["Actual Output"] ?? "").replace(/\n/g, " ").slice(0, 110)}`.replace(/\|/g, "/");
      L.push(`| ${r["Test ID"]} | ${r.Input.slice(0, 60)} | ${r.Type} | ${r["Expected Output"].slice(0, 90)} | ${actual} | ${r["Pass/Fail"]}${r["Failure Reasons"] ? ` (${r["Failure Reasons"]})` : ""} |`);
    }
    L.push("");
  }
  return L.join("\n");
}
const csvOf = (rows: EvalResultRow[]) => {
  const cols = ["Config", "Repeat", "Test ID", "Input", "Type", "Expected Output", "Actual Status", "Actual Output", "Retrieved Document", "Cited Source", "Citation Correct", "Pass/Fail", "Failure Reasons"] as const;
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\r\n");
};

/* ---------------- api ---------------- */
const tick = <T,>(v: T) => Promise.resolve(v).then(clone);

export const api = {
  health: async (): Promise<Health> => {
    const llm = await llmAvailable();
    return {
      status: "ok", llm_mode: llm ? "anthropic" : "demo", demo_mode: !llm, model: llm ? MODEL_LABEL : null,
      retrieval: { backend: "tfidf", description: RETRIEVAL_DESCRIPTION, chunks: index.chunks.length },
      documents: S.docs.filter((d) => d.status === "indexed").length,
      demo_reason: llm ? undefined : (await getSample()) === null
        ? (location.hostname.includes("claude")
          ? "Claude isn't available in this view, so answers are extracted word for word from the policy text by a local fallback, not generated by a language model. Sign in to claude.ai and allow CampusSage to use Claude to get model answers."
          : "this public copy cannot reach a language model, so answers are extracted word for word from the policy text by a local fallback, not generated by a model. The Claude-powered version runs at https://claude.ai/artifact/WTt2vSvfwz1VMsun82qr21 (sign-in needed).")
        : "Permission to use Claude was declined, so answers are extracted word for word from the policy text by a local fallback.",
    } as Health;
  },
  stats: (): Promise<Stats> => {
    const cats = new Map<string, { category: string; documents: number; chunks: number }>();
    for (const d of S.docs.filter((x) => x.status === "indexed")) {
      const c = cats.get(d.category) ?? { category: d.category, documents: 0, chunks: 0 };
      c.documents++; c.chunks += d.chunk_count; cats.set(d.category, c);
    }
    const qs = new Map<string, number>();
    for (const q of S.queries) qs.set(q.status, (qs.get(q.status) ?? 0) + 1);
    return tick({
      documents: S.docs.length, queries: S.queries.length, categories: [...cats.values()],
      query_status: [...qs].map(([status, n]) => ({ status, n })),
      feedback: { helpful: S.feedback.filter((f) => f.rating === 1).length, not_helpful: S.feedback.filter((f) => f.rating === -1).length },
      recent_documents: [...S.docs].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at) || b.id - a.id).slice(0, 5)
        .map(({ id, title, category, status, uploaded_at, is_sample }) => ({ id, title, category, status, uploaded_at, is_sample })),
    });
  },

  ask: async (question: string): Promise<ChatResponse> => {
    const r = await runPipeline(question, getVersion("final"), { guardsOn: true });
    r.id = S.next.query++;
    S.queries.push({ id: r.id, question, status: r.status, confidence: r.confidence, mode: r.mode, latency_ms: r.latency_ms, created_at: now(), response: r });
    save();
    return clone(r);
  },
  history: (limit = 20): Promise<HistoryRow[]> =>
    tick([...S.queries].reverse().slice(0, limit).map((q) => ({
      id: q.id, question: q.question, status: q.status as HistoryRow["status"], confidence: q.confidence as HistoryRow["confidence"], mode: q.mode,
      latency_ms: q.latency_ms, created_at: q.created_at, rating: [...S.feedback].reverse().find((f) => f.query_id === q.id)?.rating ?? null,
    }))),
  historyItem: (id: number): Promise<ChatResponse> => {
    const q = S.queries.find((x) => x.id === id);
    if (!q) return Promise.reject(new ApiError(404, "Query not found"));
    return tick({ ...q.response, id });
  },
  feedback: (query_id: number, rating: 1 | -1, comment?: string) => {
    if (!S.queries.some((q) => q.id === query_id)) return Promise.reject(new ApiError(404, "Query not found"));
    S.feedback.push({ query_id, rating, comment, created_at: now() });
    save();
    return tick({ ok: true });
  },

  categories: () => tick(["Academic Regulations", "Attendance Policy", "Examination Policy", "Fee Regulations", "Hostel Policy", "General Notices"]),
  documents: (): Promise<DocumentRow[]> => tick([...S.docs].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at) || b.id - a.id)),
  document: (id: number): Promise<DocumentDetail> => {
    const d = S.docs.find((x) => x.id === id);
    if (!d) return Promise.reject(new ApiError(404, "Document not found"));
    return tick({ ...d, chunks: S.chunks[id] ?? [] });
  },
  searchChunks: (q: string, k = 8): Promise<RetrievedChunk[]> => {
    const terms = contentTerms(q);
    return tick(q.trim() ? index.search(q, k).map((h) => ({
      chunk_id: h.chunk.id, document_id: h.chunk.document_id, document: h.chunk.title, category: h.chunk.category, section: h.chunk.section,
      heading: h.chunk.heading, page: h.chunk.page, text: h.chunk.text, score: Math.round(h.score * 10000) / 10000,
      term_coverage: Math.round(termCoverage(terms, indexText(h.chunk)) * 1000) / 1000,
    })) : []);
  },
  upload: async (file: File, category: string, title: string): Promise<DocumentRow> => {
    const buf = await file.arrayBuffer();
    if (new TextDecoder().decode(buf.slice(0, 4)) !== "%PDF") throw new ApiError(415, "The file does not look like a valid PDF.");
    if (file.size > 15 * 1024 * 1024) throw new ApiError(413, "File is larger than 15 MB.");
    const id = S.next.doc++;
    const d: DocumentRow = { id, title: title.trim() || file.name.replace(/\.pdf$/i, ""), filename: file.name, category, is_sample: 0, status: "processing",
      status_detail: null, pages: 0, chunk_count: 0, char_count: 0, uploaded_at: now(), indexed_at: null };
    S.docs.push(d);
    save();
    void processDoc(id, buf.slice(0));
    return clone(d);
  },
  reindex: async (id: number): Promise<DocumentRow> => {
    const d = S.docs.find((x) => x.id === id);
    if (!d) throw new ApiError(404, "Document not found");
    rebuildIndex();
    d.indexed_at = now();
    save();
    return clone(d);
  },
  deleteDocument: (id: number) => {
    if (!S.docs.some((d) => d.id === id)) return Promise.reject(new ApiError(404, "Document not found"));
    S.docs = S.docs.filter((d) => d.id !== id);
    delete S.chunks[id];
    rebuildIndex();
    save();
    return tick({ ok: true });
  },
  loadSamples: () => {
    const have = new Set(S.docs.filter((d) => d.is_sample).map((d) => d.filename));
    const s = sampleDocs(S.next.doc);
    let loaded = 0;
    for (const d of s.docs) if (!have.has(d.filename)) { const nid = S.next.doc++; S.docs.push({ ...d, id: nid }); S.chunks[nid] = s.chunks[d.id].map((c) => ({ ...c, id: `${nid}:${c.seq}` })); loaded++; }
    rebuildIndex();
    save();
    return tick({ loaded });
  },

  prompts: (): Promise<PV[]> => tick(allPrompts() as PV[]),
  createPrompt: (p: { name: string; system_prompt: string; user_template: string; temperature: number | null; base_version: string | null; notes: string }): Promise<PV> => {
    if (!p.user_template.includes("{question}")) return Promise.reject(new ApiError(422, "The user template must contain the {question} variable."));
    if (!p.user_template.includes("{policy_excerpts}") && !p.user_template.includes("{policy_text}"))
      return Promise.reject(new ApiError(422, "The user template must contain {policy_excerpts} (or {policy_text})."));
    const v: PV = { id: `custom-${S.next.prompt++}`, name: p.name.trim() || "custom", system_prompt: p.system_prompt || null, user_template: p.user_template,
      temperature: p.temperature, source: "custom (saved in this browser)", notes: p.notes, builtin: false, created_at: now(), base_version: p.base_version };
    S.prompts.push(v);
    save();
    return tick(v);
  },
  deletePrompt: (id: string) => {
    if (!id.startsWith("custom-")) return Promise.reject(new ApiError(400, "Built-in versions cannot be deleted."));
    S.prompts = S.prompts.filter((p) => p.id !== id);
    save();
    return tick({ ok: true });
  },
  preview: (version_id: string, question: string): Promise<PromptPreview> => {
    const v = getVersion(version_id);
    const [system, user] = renderPrompt(v, question, rerank(question, index.search(question, 10)).slice(0, 5));
    return tick({ version_id, system_prompt: system, user_prompt: user, temperature: v.temperature });
  },
  compare: async (question: string, versions: string[]): Promise<CompareResponse> => {
    if (!(await llmAvailable())) {
      return {
        llm_available: false,
        message: "Claude isn't available in this view, so prompt versions can't be compared here. Open this page on claude.ai while signed in and allow CampusSage to use Claude. The exact prompts that would be sent are shown below.",
        results: await Promise.all(versions.map((v) => api.preview(v, question))),
      };
    }
    const results: CompareResponse["results"] = [];
    for (const vid of versions) {
      try {
        const r = await runPipeline(question, getVersion(vid), { guardsOn: false, allowDemo: false });
        const metrics = {
          format_ok: r.parsed?.format_ok ?? false, status: r.status, quotes_verified: r.citation?.verified ?? 0, quotes_total: r.citation?.total ?? 0,
          unsupported_numbers: r.citation?.unsupported_numbers ?? [], status_inferred: r.parsed?.status_inferred ?? false, missing_fields: r.parsed?.missing_fields ?? [],
        };
        S.labRuns.unshift({ id: S.next.lab++, question, version_id: vid, mode: r.mode, model: r.model, raw_output: r.raw_output ?? "",
          parsed: r.parsed!, metrics, latency_ms: r.latency_ms, created_at: now() });
        results.push({ version_id: vid, result: r, metrics });
      } catch (e) {
        results.push({ version_id: vid, error: e instanceof Error ? e.message : String(e) });
      }
    }
    save();
    return { llm_available: true, results };
  },
  labRuns: (): Promise<LabRun[]> => tick(S.labRuns.slice(0, 30)),

  testCases: (suite: "main" | "holdout" = "main"): Promise<TestCase[]> => tick(SUITES[suite] as TestCase[]),
  evalRuns: (): Promise<EvalRun[]> => tick([...S.runs].sort((a, b) => b.id - a.id)),
  evalRun: (id: number): Promise<EvalRunDetail> => {
    const r = S.runs.find((x) => x.id === id);
    if (!r) return Promise.reject(new ApiError(404, "Run not found"));
    return tick({ ...r, results: S.results[id] ?? [] });
  },
  startEval: async (configs: string[], repeats: number, suite: "main" | "holdout") => {
    if (S.runs.some((r) => r.status === "running")) throw new ApiError(409, "A run is still in progress.");
    const llm = await llmAvailable();
    const runnable: string[] = [], skipped: Record<string, string> = {};
    for (const c of [...new Set(configs)]) {
      if (c !== "system" && !llm) skipped[c] = "needs Claude (prompt versions cannot be compared in demo mode)";
      else runnable.push(c);
    }
    const run: EvalRun = { id: S.next.run++, configs, mode: llm ? "anthropic" : "demo", model: llm ? MODEL_LABEL : null, repeats: Math.max(1, Math.min(repeats, 5)),
      suite, status: "running", progress: 0, total: runnable.length * repeats * SUITES[suite].length, summary: null, error: null, started_at: now(), finished_at: null };
    S.runs.push(run);
    save();
    void executeRun(run, runnable, skipped);
    return { run_id: run.id };
  },
  csvUrl: (id: number) => `#evaluation-${id}`,
  markdownUrl: (id: number) => `#evaluation-${id}`,
  exportCsv: async (id: number): Promise<string> => {
    const csv = csvOf(S.results[id] ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).claude;
    const downloads = c?.use ? await c.use("downloads").catch(() => null) : null;
    if (downloads) {
      try {
        await downloads.save({ filename: `campussage_run${id}.csv`, data: new Blob([csv], { type: "text/csv" }) });
        return "CSV saved.";
      } catch { /* declined: fall back to clipboard */ }
    }
    await navigator.clipboard.writeText(csv);
    return "CSV copied to the clipboard (paste it into a spreadsheet).";
  },
  exportMarkdown: async (id: number): Promise<string> => {
    const r = S.runs.find((x) => x.id === id);
    if (!r) throw new ApiError(404, "Run not found");
    await navigator.clipboard.writeText(markdownTable(r, S.results[id] ?? []));
    return "Markdown table copied to the clipboard.";
  },
  resetAll: () => { S = fresh(); rebuildIndex(); save(); },
};
