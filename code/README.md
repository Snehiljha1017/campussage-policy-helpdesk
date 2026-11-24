# code/

The course guideline asks for a `code/` folder. CampusSage's code is in two top-level folders, because the
deployment configs (`render.yaml`, Vercel, GitHub Pages) and the backend's paths expect them there:

| Folder | What it is |
|---|---|
| [`../backend/`](../backend/) | FastAPI RAG pipeline, evaluation runner, unit tests (Python) |
| [`../frontend/`](../frontend/) | React + TypeScript app; `frontend/hosted/` is the backend-free build |
| [`../app/`](../app/) | Built copy of the hosted app that GitHub Pages serves (generated: `cd frontend && npm run build:pages`) |
| [`../scripts/`](../scripts/) | Sample-policy PDF generator, Milestone 2 document builder |
