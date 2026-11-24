# Module checklist (state on 2026-11-24)

✅ = built and verified by running it · 🟡 = built, needs your API key / account / data to verify · ⬜ = not done

## Application
- ✅ Landing page (hero, features, how it works, categories, trust & privacy, footer)
- ✅ Dashboard (ask box, stats, category cards, recent questions, recent documents, FAQ, sidebar)
- ✅ Chat: status, answer, verified quotation, document + section, confidence + reason, office suggestion, copy, 👍/👎 feedback with comment, clarification follow-up, 10-step trace, retrieved excerpts
- ✅ Policy library: upload (drag-and-drop, validation), processing status, view extracted clauses, search, re-index, delete, category filter, load samples
- ✅ Prompt lab without a key: version cards, full prompt text, editor that saves new versions, assembled-prompt preview
- 🟡 Prompt lab side-by-side model outputs (needs `OPENAI_API_KEY`)
- ✅ Evaluation dashboard: run controls, progress, summary cards, Recharts charts, Normal/Edge/Invalid filter, results table, CSV + Markdown export
- ✅ About & team page
- ✅ Responsive layout (checked at 390 px and 1440 px)
- ✅ Loading, empty, error and API-offline states

## Backend / AI
- ✅ PDF extraction (pypdf verified; PyMuPDF used when installed), clause chunking, SQLite storage
- ✅ TF-IDF retrieval + reranker
- 🟡 ChromaDB + sentence-transformers retrieval (code written; not executed in our build environment. Run with `requirements-full.txt` and re-run the suites)
- ✅ Guards: validation, ambiguity + clarifying question, injection flag, personal-data refusal, evidence gate
- ✅ Output parser, citation validator, confidence cap, withholding unverifiable answers (unit-tested with a fake model)
- 🟡 Live LLM generation through LangChain/OpenAI (code complete; first live run is yours)
- ✅ Labelled demo mode when no key is set
- ✅ Prompt files V1, V2, V3, final

## Testing
- ✅ 14-case suite with machine-checked criteria (5 Normal, 5 Edge, 4 Invalid); run 001 in demo mode: 14/14
- ✅ 8-case holdout suite; run 002 in demo mode: 7/8 (H05 fails)
- ✅ 8 unit tests passing
- 🟡 V1 vs V2 vs V3 comparison with an LLM (`python -m evaluation.runner --configs system v1 v2 v3 --repeats 3`)

## Submission
- ✅ README, CHANGELOG, .env.example, .gitignore, render.yaml, vercel.json
- ✅ Six diagrams (Mermaid sources + PNG/SVG)
- ✅ Milestone 2 PDF content, technical report, reel script, form answers (with [TO FILL] fields)
- ⬜ Push to a public GitHub repository
- ✅ Hosted prototype published (claude.ai page, no backend needed); 🟡 you must share it as "anyone with the link" and test it in incognito
- ⬜ Optional: deploy the full stack (Render + Vercel)
- ⬜ Real screenshots (2–3, captioned with test numbers) and the repository screenshot
- ⬜ Record the reel
- ⬜ Enrollment numbers, faculty name, contribution table
- ⬜ Replace the sample PDFs with public Bennett documents (recommended)
