# CampusSage: Technical Report

**Team Agentic Minds (PE-B01-18)** · SCSE4041 Prompt Engineering · Bennett University · Supporting document, Milestone 2
*Export as `AgenticMinds_TechnicalReport.pdf` (1–2 pages). Replace every [TO FILL] after the LLM evaluation run.*

## 1. Purpose
CampusSage is a helpdesk that answers students' questions about attendance, examinations, fees, hostel and academic rules
using only official policy documents. The main requirement is reliability: every answer must quote the exact clause and
cite its section. It must abstain when the documents are silent, ask when a question is ambiguous, and expose
contradictions between documents instead of resolving them silently.

## 2. Architecture
A React + TypeScript single-page app (Tailwind, Framer Motion, Recharts) calls a FastAPI REST backend. The backend has four
parts:

- **Ingestion.** PyMuPDF extracts text (pypdf fallback) and repeated headers and footers are stripped. Text is split on
  numbered clauses, so each chunk keeps its section number, heading and page. Chunks are stored in SQLite and indexed.
- **Retrieval.** ChromaDB with `all-MiniLM-L6-v2` sentence embeddings, combined 70/30 with a TF-IDF keyword score. Without
  ChromaDB, a TF-IDF index of word and character n-grams is used. A lexical reranker then combines retrieval score,
  key-term coverage and answer-type match (e.g. "how much" prefers clauses containing an amount).
- **Answering pipeline (10 steps).** Validate → retrieve → rerank → evidence gate → build prompt → system prompt → generate
  (LangChain `ChatOpenAI`, temperature 0) → parse → validate citations → return or decline.
- **Evaluation.** A runner executes the test suites against any configuration and computes the metrics. It stores every
  raw output and exports CSV, JSON and Markdown.

## 3. Prompt design
One LLM prompt, **P1 Policy Answer**, does the language work. Deterministic code handles the parts that must never vary.

| Responsibility | Handled by |
|---|---|
| Empty or gibberish input, a single ambiguous term ("deadline"), another student's records | Code guards, before the LLM |
| No relevant clause retrieved (key-term coverage < 50 %) | Evidence gate: abstain and suggest an office, no LLM call |
| Reading excerpts, answering, quoting, conflicts, false assumptions, Hinglish, injection | Prompt P1 (V3 rules 1–15) |
| Is the quote really in the policy? Are all numbers in the evidence? | Citation validator, after the LLM; unverifiable answers are withheld |
| Confidence | min(model's claim, evidence-based level) |

Prompt iteration: **V1** (the Milestone 1 baseline: one user message, 4 rules, no status field) → **V2** (system prompt,
context restriction, no invented numbers, document + section citation, clarification rule, Status field, temperature 0.2)
→ **V3** (exact quotations, section taken from the excerpt header, Conflicting Evidence status, injection / false-assumption /
Hinglish rules, confidence rubric, silent 7-step procedure with a self-check, two few-shot examples, temperature 0). The
full texts are in `prompts/`.

## 4. Testing and results
Test suite: 14 inputs (5 Normal, 5 Edge, 4 Invalid) covering attendance, exam eligibility, fee deadline, hostel, academic
progression, an ambiguous question, a false assumption, an uncovered topic, Hinglish, contradictory sources, gibberish,
an out-of-scope request, prompt injection and a personal-data request. Pass criteria are machine-checked and were fixed
before running: expected status, expected clause among the verified citations, required facts, forbidden content.
A separate **holdout** set of 8 new phrasings was written after tuning and never used to tune.

| Configuration | Mode | Pass | Status acc. | Citation acc. | Hallucination | Format |
|---|---|---|---|---|---|---|
| System (guards + final prompt), main suite | demo, no LLM | 14/14 | 100 % | 100 % | 0 % | 100 % |
| System, holdout suite | demo, no LLM | 7/8 | 88 % | 80 % | 0 % | 100 % |
| V1, main suite | [TO FILL model] | [__/14] | [__] | [__] | [__] | [__] |
| V2, main suite | [TO FILL] | [__/14] | [__] | [__] | [__] | [__] |
| V3, main suite | [TO FILL] | [__/14] | [__] | [__] | [__] | [__] |
| System, main suite | [TO FILL] | [__/14] | [__] | [__] | [__] | [__] |

Eight unit tests check the code around the model with a fake LLM. They confirm that a fabricated quotation and an
invented "60 %" are detected, and that such an answer is withheld instead of shown.

## 5. Limitations
(1) Hinglish words outside the built-in vocabulary defeat the keyword evidence gate (holdout H05 failed). (2) The guard
thresholds were tuned on the main suite, so its score overstates generalisation; the holdout score is the fairer estimate.
(3) The documents are labelled samples, not official policy. (4) There is no OCR for scanned notices, and documents
carry no dates, so a newer notice can't be marked as superseding an older clause. Next steps: LLM query rewriting or
multilingual embeddings, a separate development set, Bennett's public documents, OCR and document versioning.
