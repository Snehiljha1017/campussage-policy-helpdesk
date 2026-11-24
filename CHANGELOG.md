# Changelog

All notable changes since Milestone 1. Dates are YYYY-MM-DD.

## 2026-11-24 — Milestone 2 documents
- `scripts/build_m2_docs.py` builds the Milestone 2 PDF (7 sections) and the technical report (PDF + Word) from the repository's real data.
- Screenshots of real runs (T10, T06, T01–T14, Prompt Lab) and a repository screenshot in `docs/screenshots/`.
- Architecture diagram of the hosted prototype; `code/` pointer folder as in the course structure; the Milestone 2 PDF is no longer git-ignored.
- Test table extended to all 22 inputs (14 main + 8 holdout): 21 pass, H05 fails.
- 102-second captioned reel recorded from a real run of the deployed app (uploaded separately).

## 2026-11-24 — Hosted prototype
- `frontend/hosted/`: backend-free build of the same React app. Pipeline, guards, citation checks, metrics and chunker ported to TypeScript; Claude (via claude.ai) as the model; pdf.js uploads; per-browser storage.
- Parity check: identical results to the Python backend on all 22 test inputs in demo mode.
- Published at https://claude.ai/artifact/WTt2vSvfwz1VMsun82qr21 and, via GitHub Pages from `app/`, at https://snehiljha1017.github.io/campussage-policy-helpdesk/.
- Replaced the earlier workbench in this repository (kept in history at commit 04ea202; source notes kept in docs/policy_sources.md).
- Evaluation exports became buttons; the demo banner states why demo mode is on.

## 2026-11-24 — Milestone 2 build

### Added
- FastAPI backend with REST endpoints for chat, history, feedback, documents, prompt lab and evaluation.
- PDF ingestion: PyMuPDF extraction (pypdf fallback), header/footer removal, clause-aware chunking that keeps section numbers.
- Retrieval: ChromaDB + sentence-transformers (hybrid with TF-IDF), automatic TF-IDF fallback, lexical reranker with answer-type matching.
- Deterministic guards: question validation, ambiguity detection with a generated clarifying question, prompt-injection flagging, refusal of third-party personal data, evidence-sufficiency gate.
- LLM layer through LangChain (OpenAI default, Anthropic optional, OpenAI-compatible base URL), retries, clearly labelled demo mode.
- Output parser for the final and Milestone 1 formats; citation validator (quote, section and number checks); evidence-capped confidence.
- Prompt versions as files: `prompts/v1` (Milestone 1 baseline), `prompts/v2` (context-grounded), `prompts/v3` and `prompts/final` (final optimised).
- Test suite (14 cases: 5 Normal, 5 Edge, 4 Invalid) with machine-checked pass criteria; separate 8-case holdout suite; metrics; CLI and background runner; CSV/JSON/Markdown exports.
- Unit tests (8) for chunking, parsing, citation validation, guards, conflict detection and decline-on-unverified logic.
- React frontend: landing, dashboard, chat, policy library, prompt lab, evaluation dashboard, about page; responsive layout.
- Six clearly labelled SAMPLE policy PDFs and their generator script, incl. a notice that conflicts with the fee regulations.
- Architecture, RAG pipeline, prompt workflow, task decomposition, input-output and prompt-iteration diagrams.
- Render and Vercel deployment configuration; `.env.example`.

### Results recorded
- Run 001 (demo mode, main suite): 14/14 passed.
- Run 002 (demo mode, holdout suite): 7/8 passed. H05 (Hinglish phrasing with words outside the stop-word list) was wrongly declined.

### Pending
- Prompt comparison V1 vs V2 vs V3 with an LLM API key (`python -m evaluation.runner --configs system v1 v2 v3 --repeats 3`).
- Replace sample documents with public Bennett University documents.
- Deployment links, screenshots, demonstration reel.

## 2026-11-21 – 2026-11-22 — Earlier prototype (replaced; see commit 04ea202)
- 2026-11-21: Created a public-safe CampusSage source package with prompt versions, local workbench, planned model evaluation cases, and functional checks.
- 2026-11-21: Added explicit date and paraphrase limitations for the 2024-25 policy fixture.
- 2026-11-22: Published the demo through GitHub Pages and fixed default-question retrieval.
- 2026-11-22: Added prepared-case loading, reusable retrieval and prompt logic, stricter export validation, and JSON run metadata. Twelve local checks pass; real LLM evaluations remain separate and pending.

## 2026-10-09 — Milestone 1
- Problem identification and proposal submitted (Problem Pool C1). Baseline prompt (now `prompts/v1`) and sample output defined.
- Team ID PE-B01-18 assigned.
