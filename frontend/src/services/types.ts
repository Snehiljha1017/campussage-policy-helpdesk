export type Status = "Answered" | "Needs Clarification" | "Not Covered" | "Conflicting Evidence";
export type Confidence = "High" | "Medium" | "Low";

export interface PipelineStep {
  n: number;
  name: string;
  state: "done" | "skipped" | "stopped" | "warning";
  detail: string;
}

export interface EvidenceQuote {
  quote: string;
  chunk_id: string | null;
  document: string | null;
  document_id: number | null;
  section: string | null;
  heading: string | null;
  page: number | null;
  category: string | null;
  similarity: number;
  verified: boolean;
  section_cited: boolean;
}

export interface RetrievedChunk {
  chunk_id: string;
  document_id: number;
  document: string;
  category: string;
  section: string;
  heading: string;
  page: number;
  text: string;
  score: number;
  term_coverage?: number;
}

export interface ParsedOutput {
  answer: string;
  evidence: string[];
  sources: string[];
  confidence: Confidence | null;
  status: Status | null;
  status_inferred: boolean;
  missing_fields: string[];
  format_ok: boolean;
}

export interface ChatResponse {
  id?: number;
  question: string;
  status: Status;
  answer: string;
  evidence: EvidenceQuote[];
  sources: string[];
  confidence: Confidence;
  confidence_reason: string;
  model_confidence?: Confidence | null;
  clarification_question: string | null;
  office_suggestion: string | null;
  flags: string[];
  retrieved: RetrievedChunk[];
  mode: "demo" | "openai" | "anthropic";
  model: string | null;
  prompt_version: string;
  guards: boolean;
  raw_output: string | null;
  parsed: ParsedOutput | null;
  citation: { verified: number; total: number; unsupported_numbers: string[]; cited_sections: string[] } | null;
  evidence_check: { sufficient: boolean; coverage: number; top_coverage: number; top_score: number; terms: string[]; reason: string } | null;
  pipeline: PipelineStep[];
  latency_ms: number;
}

export interface Health {
  status: string;
  llm_mode: "demo" | "openai" | "anthropic";
  demo_mode: boolean;
  model: string | null;
  retrieval: { backend: string; description: string; chunks: number };
  documents: number;
  demo_reason?: string;
}

export interface DocumentRow {
  id: number;
  title: string;
  filename: string;
  category: string;
  is_sample: number;
  status: "uploaded" | "processing" | "indexed" | "failed";
  status_detail: string | null;
  pages: number;
  chunk_count: number;
  char_count: number;
  uploaded_at: string;
  indexed_at: string | null;
}

export interface DocumentDetail extends DocumentRow {
  chunks: { id: string; seq: number; section: string; heading: string; page: number; text: string }[];
}

export interface Stats {
  documents: number;
  queries: number;
  categories: { category: string; documents: number; chunks: number }[];
  query_status: { status: string; n: number }[];
  feedback: { helpful: number; not_helpful: number };
  recent_documents: Pick<DocumentRow, "id" | "title" | "category" | "status" | "uploaded_at" | "is_sample">[];
}

export interface HistoryRow {
  id: number;
  question: string;
  status: Status;
  confidence: Confidence;
  mode: string;
  latency_ms: number;
  created_at: string;
  rating: number | null;
}

export interface PromptVersion {
  id: string;
  name: string;
  system_prompt: string | null;
  user_template: string;
  temperature: number | null;
  source: string;
  notes: string;
  builtin: boolean;
  created_at: string | null;
  base_version: string | null;
}

export interface PromptPreview {
  version_id: string;
  system_prompt: string | null;
  user_prompt: string;
  temperature: number | null;
}

export interface CompareMetrics {
  format_ok: boolean;
  status: Status;
  quotes_verified: number;
  quotes_total: number;
  unsupported_numbers: string[];
  status_inferred: boolean;
  missing_fields: string[];
}

export interface CompareResponse {
  llm_available: boolean;
  message?: string;
  results: (PromptPreview | { version_id: string; result?: ChatResponse; metrics?: CompareMetrics; error?: string })[];
}

export interface LabRun {
  id: number;
  question: string;
  version_id: string;
  mode: string;
  model: string | null;
  raw_output: string;
  parsed: ParsedOutput;
  metrics: CompareMetrics;
  latency_ms: number;
  created_at: string;
}

export interface MetricSet {
  pass_rate: number | null;
  status_accuracy: number | null;
  factual_correctness: number | null;
  citation_accuracy: number | null;
  hallucination_rate: number | null;
  policy_grounding: number | null;
  format_compliance: number | null;
  consistency: number | null;
}

export interface ConfigSummary {
  tests: number;
  outputs: number;
  repeats: number;
  passed: number;
  failed: number;
  by_type: Record<string, { total: number; passed: number }>;
  metrics: MetricSet;
}

export interface EvalRun {
  id: number;
  configs: string[];
  mode: string;
  model: string | null;
  repeats: number;
  suite: "main" | "holdout";
  status: "running" | "completed" | "failed";
  progress: number;
  total: number;
  summary: { configs: Record<string, ConfigSummary>; skipped: Record<string, string>; demo_mode: boolean } | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface EvalResultRow {
  Config: string;
  Repeat: number;
  "Test ID": string;
  Input: string;
  Type: "Normal" | "Edge" | "Invalid";
  "Expected Output": string;
  "Actual Status": string;
  "Actual Output": string;
  "Retrieved Document": string;
  "Cited Source": string;
  "Citation Correct": "Yes" | "No" | "n/a";
  "Pass/Fail": "Pass" | "Fail";
  "Failure Reasons": string;
}

export interface EvalRunDetail extends EvalRun {
  results: EvalResultRow[];
}

export interface TestCase {
  id: string;
  type: "Normal" | "Edge" | "Invalid";
  category: string;
  input: string;
  expected_output: string;
  expected_status: Status[];
}
