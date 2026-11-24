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
- ✅ V1 vs V2 vs V3 comparison on Claude (run 3, 24 Nov 2026): V1 9/14, V2 13/14, V3 14/14, system 14/14
- ⬜ Optional: repeat it with 3 repeats and a fixed temperature through the backend (`python -m evaluation.runner --configs system v1 v2 v3 --repeats 3`)

## Submission
- ✅ README, CHANGELOG, .env.example, .gitignore, render.yaml, vercel.json
- ✅ Six diagrams (Mermaid sources + PNG/SVG)
- ✅ Milestone 2 PDF + technical report built as PDF and Word with the Claude results, faculty, reel link and contribution table; only the two enrollment numbers are still highlighted
- ✅ Pushed to https://github.com/Snehiljha1017/campussage-policy-helpdesk
- ✅ Public prototype on GitHub Pages (no login) with the recorded Claude run on its Evaluation page; Claude-powered copy on claude.ai (owner-only unless shared)
- ⬜ Optional: deploy the full stack (Render + Vercel)
- ✅ Real screenshots (T10, T06, T01–T14, Prompt Lab) and the repository screenshot in docs/screenshots
- ✅ Reel (126 s, captioned): Part 2 now shows the real Claude outputs of V1 and V3 for T10 and the V1/V2/V3 chart; public at https://snehiljha1017.github.io/campussage-policy-helpdesk/docs/demo/
- ✅ Faculty name (Sonal Kukreja), contribution table (50 / 50, from the commit history)
- ⬜ Enrollment numbers of both members
- ⬜ Replace the sample PDFs with public Bennett documents (recommended)
