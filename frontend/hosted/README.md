# Hosted (backend-free) build of CampusSage

Live copies: https://snehiljha1017.github.io/campussage-policy-helpdesk/ (GitHub Pages, demo mode, public) · https://claude.ai/artifact/WTt2vSvfwz1VMsun82qr21 (claude.ai, uses Claude; owner must share it).
The Pages copy is the built output in the repository's `app/` folder: `cd frontend && npm run build:pages`.

This folder builds the **same React app** as `npm run build`, but replaces the FastAPI backend with an in-browser
port of it, so the prototype can be hosted as a single static page with no server and no API key:

| Backend (Python) | Hosted port (TypeScript) |
|---|---|
| `backend/rag/vector_store.py` TF-IDF index | `engine/index.ts`: same scikit-learn maths (word 1–2 grams + char_wb 3–5, sublinear tf, smoothed idf) |
| `backend/rag/{guards,rerank,citation,output_parser,confidence,demo_answerer,offices}.py`, `document_processing/chunker.py`, `prompts/loader.py` | `engine/logic.ts` |
| `backend/rag/pipeline.py` | `engine/pipeline.ts` |
| `backend/evaluation/metrics.py` | `engine/metrics.ts` |
| LangChain → OpenAI | `engine/llm.ts`: Claude through the claude.ai page runtime (`sample` capability), viewer consent required |
| SQLite | the viewer's own browser storage (each viewer has a private copy) |
| PyMuPDF upload | pdf.js in the browser |

`data.generated.json` holds the sample clauses chunked by the **Python** chunker, the test suites, the prompt files
and the two recorded backend runs. Regenerate it after changing any of those: `python frontend/hosted/export_data.py`.

**Parity check (2026-11-24):** on all 22 test inputs (14 main + 8 holdout) the TypeScript engine in demo mode gives the
same status, answer text, top retrieved clause, verified citations and pass/fail as the Python backend, and the same
retrieval scores to 4 decimal places.

Differences from the full app: retrieval is TF-IDF only (no ChromaDB embeddings); the model is Claude (via claude.ai),
not OpenAI, and its temperature cannot be set, so V2/V3's temperature settings do not apply here; data is stored
per browser; without Claude (signed-out viewers, or consent declined) the page runs in the labelled demo mode.

Build: `cd frontend && npm install && npm run build:hosted` → `hosted/dist/` (index.html, app.js, app.css,
pdf.worker.min.mjs). Publish those four files together.
