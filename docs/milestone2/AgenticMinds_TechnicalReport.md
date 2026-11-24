# CampusSage — Technical Report

**Team Agentic Minds (PE-B01-18) · SCSE4041 Prompt Engineering · Bennett University · Technical report**

## 1. Purpose
CampusSage answers students' questions about attendance, examinations, fees, hostel and academic rules using only
official policy documents. The main requirement is reliability. Every answer must quote the exact clause and cite its
section. It must abstain when the documents are silent, ask when a question is ambiguous, and report contradictions
between documents instead of silently picking one.

## 2. Architecture and tools
React + TypeScript single-page app (Tailwind, Framer Motion, Recharts) with a FastAPI REST backend.
**Ingestion:** PyMuPDF extraction (pypdf fallback), header/footer removal, chunking on numbered clauses so each chunk
keeps its section number, then SQLite storage. **Retrieval:** TF-IDF over word and character n-grams (ChromaDB +
all-MiniLM-L6-v2 optional), followed by a reranker that combines retrieval score, key-term coverage and answer type.
**Pipeline (10 steps):** validate → retrieve → rerank → evidence check → build prompt → system prompt → generate →
parse → validate citations → return or decline. **Model:** Claude (via claude.ai) in the CampusSage web app; the backend uses LangChain (OpenAI by
default). **Hosting:** a backend-free build (the same pipeline ported to TypeScript, parity-checked on all 22
inputs) on GitHub Pages and claude.ai.

## 3. Prompt design
One LLM prompt, **P1 Policy Answer**, does the language work, and code handles what must never vary. Before the model
is called: empty or gibberish input, a single ambiguous term, requests for another student's records, and questions
whose key terms are less than 50% covered by the retrieved clauses (the system abstains and names an office). After the
model answers: each quotation must match a retrieved clause at 90% or more, every number must appear in the evidence,
unverifiable answers are withheld, and confidence = min(model's claim, evidence level).
Iteration: **V1** (Milestone 1 baseline: one message, 4 rules, no status) → **V2** (system prompt, context restriction,
no invented numbers, document + section citation, clarification rule, Status field) → **V3** (exact quotations,
section from the excerpt header, Conflicting Evidence status, injection, false-assumption and Hinglish rules,
confidence rubric, silent 7-step procedure with a self-check, 2 few-shot examples).

## 4. Test results
22 inputs (14 edge/invalid) with pass criteria checked by code. H01–H08 were written after tuning and never
used to tune.

| Configuration | Pass | Status acc. | Citation acc. | Hallucination | Format |
|---|---|---|---|---|---|
| System, main suite, demo mode | 14/14 | 100% | 100% | 0% | 100% |
| System, holdout, demo mode | 7/8 | 88% | 80% | 0% | 100% |
| V1, V2, V3 with Claude | [TO FILL after the Claude run]{.mark} | | | | |

Eight unit tests check the code around the model using a stand-in model: a fabricated quotation and an invented "60%" are
detected, and the answer is withheld.

## 5. Limitations
Four known limits. First, Hinglish words outside the built-in vocabulary defeat the keyword evidence check (holdout H05 failed). Second, thresholds
were tuned on the main suite, so the holdout score is the fairer estimate. Third, the documents are labelled samples, not
official policy. Fourth, there is no OCR and no document dating. Next: LLM query rewriting, a separate development set,
Bennett's public documents, OCR and document versioning.
