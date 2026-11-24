import type {
  ChatResponse, CompareResponse, DocumentDetail, DocumentRow, EvalRun, EvalRunDetail, Health, HistoryRow, LabRun,
  PromptPreview, PromptVersion, RetrievedChunk, Stats, TestCase,
} from "./types";

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError(0, `Cannot reach the CampusSage API at ${API_URL}. Is the backend running?`);
  }
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  health: () => request<Health>("/api/health"),
  stats: () => request<Stats>("/api/stats"),

  ask: (question: string) => request<ChatResponse>("/api/chat", json({ question })),
  history: (limit = 20) => request<HistoryRow[]>(`/api/history?limit=${limit}`),
  historyItem: (id: number) => request<ChatResponse>(`/api/history/${id}`),
  feedback: (query_id: number, rating: 1 | -1, comment?: string) =>
    request<{ ok: boolean }>("/api/feedback", json({ query_id, rating, comment })),

  categories: () => request<string[]>("/api/documents/categories"),
  documents: () => request<DocumentRow[]>("/api/documents"),
  document: (id: number) => request<DocumentDetail>(`/api/documents/${id}`),
  searchChunks: (q: string, k = 8) => request<RetrievedChunk[]>(`/api/documents/search?q=${encodeURIComponent(q)}&k=${k}`),
  upload: (file: File, category: string, title: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    fd.append("title", title);
    return request<DocumentRow>("/api/documents", { method: "POST", body: fd });
  },
  reindex: (id: number) => request<DocumentRow>(`/api/documents/${id}/reindex`, { method: "POST" }),
  deleteDocument: (id: number) => request<{ ok: boolean }>(`/api/documents/${id}`, { method: "DELETE" }),
  loadSamples: () => request<{ loaded: number }>("/api/documents/load-samples", { method: "POST" }),

  prompts: () => request<PromptVersion[]>("/api/prompts"),
  createPrompt: (p: { name: string; system_prompt: string; user_template: string; temperature: number | null; base_version: string | null; notes: string }) =>
    request<PromptVersion>("/api/prompts", json(p)),
  deletePrompt: (id: string) => request<{ ok: boolean }>(`/api/prompts/${id}`, { method: "DELETE" }),
  preview: (version_id: string, question: string) => request<PromptPreview>("/api/lab/preview", json({ version_id, question })),
  compare: (question: string, versions: string[]) => request<CompareResponse>("/api/lab/compare", json({ question, versions })),
  labRuns: () => request<LabRun[]>("/api/lab/runs"),

  testCases: (suite: "main" | "holdout" = "main") => request<TestCase[]>(`/api/eval/cases?suite=${suite}`),
  evalRuns: () => request<EvalRun[]>("/api/eval/runs"),
  evalRun: (id: number) => request<EvalRunDetail>(`/api/eval/runs/${id}`),
  startEval: (configs: string[], repeats: number, suite: "main" | "holdout") =>
    request<{ run_id: number }>("/api/eval/runs", json({ configs, repeats, suite })),
  csvUrl: (id: number) => `${API_URL}/api/eval/runs/${id}/export.csv`,
  markdownUrl: (id: number) => `${API_URL}/api/eval/runs/${id}/table.md`,
  exportCsv: async (id: number) => {
    window.open(`${API_URL}/api/eval/runs/${id}/export.csv`, "_blank");
    return "CSV download started.";
  },
  exportMarkdown: async (id: number) => {
    window.open(`${API_URL}/api/eval/runs/${id}/table.md`, "_blank");
    return "Markdown table opened in a new tab.";
  },
};
