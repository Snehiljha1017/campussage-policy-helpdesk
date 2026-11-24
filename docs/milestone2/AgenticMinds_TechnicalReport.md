# CampusSage — Technical Report

**Team Agentic Minds (PE-B01-18) · SCSE4041 Prompt Engineering · Bennett University · Technical report**

## 1. Purpose
Students lose time, and sometimes money, because the rules they need are buried in long PDFs and notices, and asking
a senior often gets a confident but wrong answer. CampusSage answers from the policy documents alone, and what mattered
most to us was trust: every answer quotes the exact clause and its section. When the documents are silent it says so,
when a question is vague it asks, and when two documents disagree it says that instead of quietly picking one.

## 2. Architecture and tools
A React + TypeScript front end (Tailwind, Framer Motion, Recharts) runs on a FastAPI back end. Uploaded PDFs are read
with PyMuPDF (pypdf as a fallback), cleaned of headers and footers, split on their numbered clauses so each chunk keeps
its section number, and stored in SQLite. Questions are matched with TF-IDF over words and character n-grams (ChromaDB
optional), and a reranker prefers clauses that cover the key terms. A ten-step pipeline validates, retrieves, reranks,
checks the evidence, builds the prompt, adds the system prompt, generates, parses, verifies citations and then answers or
declines. The model is
Claude (via claude.ai) in the CampusSage web app, reached through LangChain in the back end. So anyone can try it without a server or API key, we ported
the pipeline to TypeScript (same results on all 22 test inputs) and host it on GitHub Pages and claude.ai.

## 3. Prompt design
We gave the model one job: a single prompt, **P1 Policy Answer**, reads the excerpts, answers, quotes the clause and
labels the status. Whatever must never vary is done in code. Before the model runs, code catches gibberish, a lone
ambiguous word, requests for another student's records, and questions less than half covered by the retrieved clauses
(CampusSage then declines and names an office). Afterwards, each quotation must match a clause at 90% or more, every
number must appear in the evidence, unverifiable answers are held back, and confidence never exceeds the evidence.
The prompt went through three versions. **V1**, our Milestone 1 baseline, was one message with four rules and no
status. **V2** moved the rules into a system prompt, kept answers to the excerpts, banned invented numbers and added a
Status field. **V3**, the final version, asks for word-for-word quotations, adds a Conflicting Evidence status and rules
for injected instructions, false assumptions and Hinglish, scores confidence with a rubric, and gives two worked examples.

## 4. Test results
We wrote 22 test inputs (14 edge or invalid), and code, not our judgement, decides pass or fail. The holdout
questions H01–H08 were written after tuning. To compare prompts fairly, we ran V1, V2 and V3 live on Claude (claude.ai,
24 Nov 2026, one repeat) with the same retrieved excerpts, so only the prompt changed.

| Configuration (main = 14 tests, holdout = 8) | Pass | Status acc. | Citation acc. | Hallucination | Format |
|------------|---|---|---|---|---|
| Full system, main, demo mode | 14/14 | 100% | 100% | 0% | 100% |
| Full system, holdout, demo mode | 7/8 | 88% | 80% | 0% | 100% |
| Full system, main, Claude | 14/14 | 100% | 100% | 0% | 100% |
| V1 prompt alone, main, Claude | 9/14 | 86% | 50% | 29% | 7% |
| V2 prompt alone, main, Claude | 13/14 | 93% | 100% | 0% | 100% |
| V3 prompt alone, main, Claude | 14/14 | 100% | 100% | 0% | 100% |

Most of the gain came from the output format and the conflict rule: V1 had no status, answered a vague question
instead of asking and settled the late-fee conflict itself, while V3 passed all fourteen. Eight unit tests also confirm
that a made-up quotation or an invented "60%" is caught and the answer withheld.

## 5. Limitations
We know of five weak spots. Hinglish words outside our small vocabulary still defeat the evidence check (holdout H05
failed). Thresholds were tuned on the main suite, so the holdout score is the fairer estimate. The documents are
labelled samples, not official policy. There is no OCR, and without document dates a newer notice cannot yet replace
an older clause. And the Claude comparison is a single run, with no control over temperature on claude.ai. Next: query
rewriting, a separate development set, repeated runs at a fixed temperature, Bennett's public documents and OCR.
