"""Build the Milestone 2 documents from the repository's real data.

    python scripts/build_m2_docs.py

Inputs : docs/milestone2/m2_inputs.json (team-only facts, LLM results once available),
         prompts/*, test-data/evaluation_results/*.json, docs/architecture|workflow/*.png, docs/screenshots/*.png
Outputs: docs/milestone2/M2_PE-B01-18_CampusSage.{md,pdf,docx}
         docs/milestone2/AgenticMinds_TechnicalReport.{md,pdf,docx}
Needs  : pandoc; for PDF, Node + Playwright with Chrome (set CHROME_PATH / PLAYWRIGHT_MODULE if not default).
Values starting with "TO FILL" are printed highlighted so nothing unfinished goes unnoticed.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
M2 = ROOT / "docs" / "milestone2"
INP = json.loads((M2 / "m2_inputs.json").read_text(encoding="utf-8"))
LLM = INP.get("llm_results")


def fill(v) -> str:
    v = str(v)
    return f"[{v}]{{.mark}}" if v.startswith("TO FILL") else v


def esc(s: str) -> str:
    return str(s).replace("|", "/").replace("\n", " ").strip()


def short(s: str, n: int) -> str:
    s = esc(s)
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def block(heading: str, text: str) -> str:
    m = re.search(rf"^##\s+{re.escape(heading)}\s*\n+```[a-z]*\n(.*?)\n```", text, re.M | re.S)
    return m.group(1).strip() if m else ""


def fm(text: str, key: str) -> str:
    m = re.search(rf"^{key}:\s*(.+)$", text, re.M)
    return m.group(1).strip() if m else ""


PROMPTS = {v: (ROOT / "prompts" / p).read_text(encoding="utf-8") for v, p in {
    "v1": "v1/P1_policy_answer_v1.md", "v2": "v2/P1_policy_answer_v2.md", "v3": "v3/P1_policy_answer_v3.md"}.items()}


def latest_run(suite: str) -> dict:
    files = sorted((ROOT / "test-data" / "evaluation_results").glob(f"run*_{suite}_*.json"))
    return json.loads(files[-1].read_text(encoding="utf-8")) if files else {}


MAIN, HOLD = latest_run("main"), latest_run("holdout")
# Live LLM run recorded in the claude.ai copy (imported by scripts/import_claude_run.py).
_claude = sorted((ROOT / "test-data" / "evaluation_results" / "claude_ai").glob("run*_main_*.json"))
CLAUDE = json.loads(_claude[-1].read_text(encoding="utf-8")) if _claude else {}
CONFIG_LABEL = {"system": "System (V3 + guards)", "v1": "V1 prompt", "v2": "V2 prompt", "v3": "V3 prompt"}
CASES = {c["id"]: c for f in ("test_cases.json", "holdout_cases.json")
         for c in json.loads((ROOT / "test-data" / "inputs" / f).read_text(encoding="utf-8"))["cases"]}


def rows(run: dict) -> list[dict]:
    return [r for r in run.get("results", []) if r["Config"] == "system" and r["Repeat"] == 1]


ALL_ROWS = rows(MAIN) + rows(HOLD)
N_TESTS = len(ALL_ROWS)
N_EDGE = sum(r["Type"] != "Normal" for r in ALL_ROWS)
N_PASS = sum(r["Pass/Fail"] == "Pass" for r in ALL_ROWS)


def compact(answer: str | None) -> str:
    """'As per Fee Regulations (Sample), Section 1.2: text' -> '[§1.2] text' so the table shows the fact itself."""
    return re.sub(r"As per .+? \(Sample\), Section ([\d.]+): ", r"[§\1] ", answer or "")


def pct(x) -> str:
    return "n/a" if x is None else f"{round(x * 100)}%"


def summary(run: dict) -> dict:
    return (run.get("summary") or {}).get("configs", {}).get("system", {})


SM, SH = summary(MAIN), summary(HOLD)
LLM_PENDING = "TO FILL after the Claude run: metrics from the Evaluation page (system, v1, v2, v3)"

# ----------------------------------------------------------------------------------------------
def img(path: str, caption: str, width: str = "100%") -> str:
    return f"![{caption}]({path}){{width={width}}}\n"


def code(text: str) -> str:
    return "```text\n" + text + "\n```\n"


def cover() -> str:
    mem = "\n".join(f"| {m['name']}{' (team leader)' if m.get('leader') else ''} | {fill(m['enrollment'])} |" for m in INP["members"])
    return f"""# 1 Cover page

**CampusSage — AI-Powered University Policy & Student Helpdesk**

| | |
|---|---|
| Team ID | PE-B01-18 |
| Team name | Agentic Minds |
| Project title | CampusSage — AI-Powered University Policy & Student Helpdesk |
| Course | SCSE4041 Prompt Engineering, Bennett University |
| Batch | {INP['batch']} |
| Faculty name | {fill(INP['faculty_name'])} |
| Problem source | Problem Pool, C1 |

| Member | Enrollment no. |
|---|---|
{mem}

| Link | URL |
|---|---|
| Prototype | {INP['prototype_link']} |
| Prototype with the LLM (Claude) | {INP['prototype_link_llm']} |
| Repository | {INP['repository_link']} |
| Reel | {fill(INP['reel_link'])} |
"""


def design() -> str:
    v3 = PROMPTS["v3"]
    sample = (f"Input ({LLM['sample_run']['input']}):\n\n" + code(LLM["sample_run"]["output"])) if LLM and LLM.get("sample_run") else \
        f"[TO FILL after the Claude run: one real input (e.g. test T10) and the model's raw output, copied from the Prompt Lab or chat]{{.mark}}"
    if LLM and LLM.get("sample_run", {}).get("v1_output"):
        sample += ("\nFor comparison, the same input and excerpts with **V1** (the Milestone 1 baseline). It has no Status field, "
                   "so the app had to infer \"Answered\", and it decides by itself which rate applies instead of reporting the conflict:\n\n"
                   + code(LLM["sample_run"]["v1_output"]))
    return f"""# 2 Prompt and solution design

## (a) Design summary

**Problem and users.** Bennett University students, especially first-year students, hostel residents and their parents,
need the rules on attendance, examinations, fees and hostel life. Those rules are spread across long PDFs and notices.
Students ask seniors or staff and get inconsistent answers, which leads to missed deadlines and avoidable penalties.
Office staff answer the same questions again and again.

**Input and output.** Input: a free-text question in English or Hinglish. Output: a short answer, the exact supporting
quotation, the document and section, a High/Medium/Low confidence and a status (Answered / Needs Clarification / Not
Covered / Conflicting Evidence). When the policy is silent, the output also names the office to contact.

**How many prompts/steps and why.** The final solution uses **one LLM prompt (P1, policy answer)** inside a 10-step
pipeline. Steps that need judgement but must never vary are done in code because code is free and fully repeatable:
validating the question, detecting ambiguity, checking that the retrieved clauses really cover the question,
verifying citations and capping confidence. The LLM does only the language task: read the excerpts, answer, quote and
classify. Using one prompt also makes the iteration measurable, because only that prompt changes between versions.

**Tool and model, and why.** {INP['model']}. Retrieval-augmented generation keeps answers tied to the policy text instead
of the model's memory. The full backend calls the model through LangChain (OpenAI by default, Claude optional) from
FastAPI. The hosted prototype runs the same pipeline in the browser and calls Claude through the claude.ai page runtime,
so it needs no server or API key. A web app was needed for document upload, the prompt lab and the test dashboard.

**What changed since Milestone 1.** The Milestone 1 baseline prompt became V1. We wrote V2 (context-grounded) and V3
(final), and built the application around them: PDF ingestion with clause-level chunking, retrieval, deterministic
guards, citation validation, a prompt lab and an automated evaluation (14 test cases plus an 8-case holdout set). We also
acted on our senior reviewer's Milestone 1 feedback. The prompt now requires the exact policy clause, ambiguous
questions get a clarifying question, the citation validator blocks "untethered" answers, and the tests cover many kinds
of question.

## (b) Diagrams

All diagrams are drawn from the implemented code (Mermaid sources in `docs/architecture` and `docs/workflow`).

{img('docs/workflow/prompt_workflow.png', 'Figure 1. Prompt workflow (P1)')}
{img('docs/workflow/task_decomposition.png', 'Figure 2. Task decomposition', '80%')}
{img('docs/workflow/input_output_flow.png', 'Figure 3. Input–output flow')}
{img('docs/architecture/system_architecture.png', 'Figure 4. System architecture (full build: React + FastAPI)')}
{img('docs/architecture/hosted_architecture.png', 'Figure 5. System architecture of the hosted prototype (the link evaluators open)')}
{img('docs/architecture/rag_pipeline.png', 'Figure 6. RAG pipeline (10 steps)', '62%')}

## (c) Prompt sheet

### P1 — Policy Answer Prompt (final = V3)

| Field | Value |
|-----|---------------|
| Prompt ID and name | P1 — Policy Answer Prompt |
| Step in the workflow | Steps 6–8 of the RAG pipeline: after retrieval, reranking and the evidence check; before citation validation |
| Purpose | Answer a student's question using only the retrieved policy excerpts, with an exact quotation, the section, a confidence and a status |
| Tool and model | {INP['model']} |
| Settings | temperature 0 in the full backend (the claude.ai runtime uses its default temperature); top-5 excerpts |
| Full system prompt | Below |
| User prompt template | Below |
| Variables | `{{policy_excerpts}}` = top-5 retrieved clauses, each `[E<n>] <document title> - Section <n> (<heading>)` followed by the clause text; `{{question}}` = the student's question exactly as typed |
| Number of examples | 2 (one Answered, one Not Covered; a made-up library policy, so no test content leaks) |
| Output format | Five labelled fields in this order: Answer, Supporting Evidence, Source, Confidence, Status |

**Full system prompt**

{code(block('System Prompt', v3))}
**User prompt template**

{code(block('User Prompt Template', v3))}
**Sample run (real input and actual output)**

{sample}
"""


def implementation() -> str:
    llm_ok = bool(LLM)
    gen = ("Partly working", "Works with Claude in the claude.ai copy (live run recorded: " + LLM["run"] + "). The public link has no model, "
           "so there it answers with the labelled extractive fallback") if llm_ok else (
        "Partly working", "Code complete and unit-tested with a stand-in model; the first live Claude run is pending")
    lab = ("Partly working", "V1/V2/V3 compared live on Claude in the claude.ai copy. On the public link it shows the prompts, editor, "
           "history and the recorded run, but cannot run a new comparison") if llm_ok else ("Partly working", "Compare needs Claude; without it the lab shows the exact prompts")
    status = [
        ("Document ingestion", "Upload PDF, extract text, split into numbered clauses, index; view, re-index, delete", "Working", "Tested in the backend and in the browser build (pdf.js); no OCR"),
        ("Retrieval and reranking", "TF-IDF word + character n-grams; reranks by key-term coverage and answer type", "Working", "ChromaDB embeddings optional in the backend (not used in tests)"),
        ("Question guards", "Gibberish, ambiguity, injection, personal-data and evidence checks", "Working", "T06, T08, T11–T14 and 8 unit tests"),
        ("Answer generation (LLM)", "Prompt P1 via LangChain (backend) or Claude (hosted)", gen[0], gen[1]),
        ("Citation validation and confidence", "Verifies quotes, sections and numbers; caps confidence; withholds unverifiable answers", "Working", "Unit tests reject a fabricated quote and number"),
        ("Chat interface", "Ask, cited answer card, copy, feedback, clarification follow-up, 10-step trace", "Working", "Screenshots 1–2"),
        ("Prompt lab", "Compare V1/V2/V3, prompt editor, version history, run log", lab[0], lab[1]),
        ("Evaluation dashboard", "Runs the suites, charts, Normal/Edge/Invalid filter, CSV/Markdown export", "Working", "Screenshot 3"),
        ("Deployment", "GitHub Pages (public) and claude.ai (with Claude)", "Working", "Both links tested on 24 Nov 2026"),
    ]
    st = "\n".join(f"| {a} | {b} | {c} | {d} |" for a, b, c, d in status)

    def res(v):
        if not LLM:
            return f"[{LLM_PENDING}]{{.mark}}"
        m = LLM["metrics"].get(v, {})
        nums = ", ".join(f"{k.replace('_', ' ')} {pct(val)}" for k, val in m.items())
        return esc(f"{nums}. {LLM.get('observations', {}).get(v, '')}")

    v2why = "V1 had no status field, so the app had to guess whether it answered, declined or asked back; \"Source clause\" invited paraphrase that could not be verified"
    v3why = (esc(LLM["observations"].get("v2_problems", "")) if LLM and LLM.get("observations", {}).get("v2_problems") else
             "V2 had no rule for contradicting sources, injected instructions, false assumptions or Hinglish, and its confidence was not tied to evidence")
    log = f"""| Version | What changed | Why it was changed | Result after the change |
|--|--------------|----------|----------|
| v1 | Milestone 1 baseline: one user message, 4 rules, fields Answer / Source clause / Section / Confidence (High/Low), default temperature | Starting point | {res('v1')} |
| v2 | Rules moved to a system prompt; explicit context restriction; "never guess a number"; document + section citation; clarification rule; Status field and Medium confidence added; temperature 0.2 | {v2why} | {res('v2')} |
| v3 | Final rules 1–15; exact word-for-word quotation; section taken from the excerpt header; Conflicting Evidence status; injection, false-assumption and Hinglish rules; confidence rubric; silent 7-step procedure with a self-check; 2 few-shot examples; temperature 0 | {v3why} | {res('v3')} |
"""
    full = ""
    for v, title in (("v1", "V1 — Baseline (Milestone 1)"), ("v2", "V2 — Context-grounded"), ("v3", "V3 — Final optimised")):
        t = PROMPTS[v]
        full += f"### {title} (temperature: {fm(t, 'temperature')})\n\n**System prompt**\n\n{code(block('System Prompt', t))}\n**User prompt template**\n\n{code(block('User Prompt Template', t))}\n"
    return f"""# 3 Implementation

**What is built.** A working web application with seven pages: landing, dashboard, chat, policy library, prompt lab,
evaluation dashboard and about/team. Policy PDFs are extracted, split into numbered clauses and indexed. The chat runs
the 10-step pipeline and shows the verified quotation, section, confidence, office suggestion and a trace of every step.
The prompt lab runs one question through V1/V2/V3 side by side, and the team can save new versions. The evaluation
dashboard runs the test suites and charts the measured metrics. The same app exists as a FastAPI + React build and as a
backend-free build hosted on GitHub Pages and claude.ai. A parity check showed both give identical results on all
{N_TESTS} test inputs in demo mode.

## Module status table

| Module | What it does | Status | Notes |
|---------|---------------|------|------------|
{st}

## Prompt iteration log

{log}
*Results come from the in-app Evaluation page: the same {len(rows(MAIN))} test inputs and the same retrieval for every
version, with metrics computed automatically (definitions in `backend/evaluation/metrics.py`).*

## Full text of every prompt version

{full}"""


def testing() -> str:
    tbl = "\n".join(
        f"| {r['Test ID']} | {short(r['Input'], 80)} | {r['Type']} | {short(r['Expected Output'], 95)} | "
        f"{short(r['Actual Status'] + ': ' + compact(r['Actual Output']), 150)} | **{r['Pass/Fail']}**"
        + (f" ({short(r['Failure Reasons'], 70)})" if r['Failure Reasons'] else "") + " |"
        for r in ALL_ROWS)
    return f"""# 4 Demonstration and testing

## Test table

{N_TESTS} test inputs: {sum(r['Type']=='Normal' for r in ALL_ROWS)} Normal, {sum(r['Type']=='Edge' for r in ALL_ROWS)} Edge, {sum(r['Type']=='Invalid' for r in ALL_ROWS)} Invalid.
T01–T14 is the main suite. H01–H08 is a holdout set, written after the guard thresholds were tuned and never used to tune
them. Actual outputs come from the deployed system in **demo mode** (the pipeline with its extractive fallback, no LLM
call), runs {MAIN.get('run', {}).get('id', '?')} and {HOLD.get('run', {}).get('id', '?')} recorded on {str(MAIN.get('run', {}).get('started_at', ''))[:10]}.
Pass criteria were fixed before the runs and are checked by code.

| Test no. | Input (short) | Type | Expected output | Actual output (short) | Pass / Fail |
|----|--------------|-----|-------------------|-----------------------|----------|
{tbl}

Result: **{N_PASS}/{N_TESTS} passed** (main suite {SM.get('passed', '?')}/{SM.get('tests', '?')}, holdout {SH.get('passed', '?')}/{SH.get('tests', '?')}).
Citation accuracy {pct(SM.get('metrics', {}).get('citation_accuracy'))} (main) and {pct(SH.get('metrics', {}).get('citation_accuracy'))} (holdout); hallucination rate {pct(SM.get('metrics', {}).get('hallucination_rate'))}.
The main-suite score overstates generalisation, because the thresholds were tuned on it; the holdout result is the fairer estimate.

## Screenshots of real runs

{img('docs/screenshots/T10_conflicting_evidence.png', 'Screenshot 1 — Test T10: contradictory sources reported as Conflicting Evidence, both clauses quoted and verified', '82%')}
{img('docs/screenshots/T06_clarification_then_answer.png', 'Screenshot 2 — Test T06: one clarifying question, then the follow-up answered from Fee Regulations §1.2', '82%')}
{img('docs/screenshots/T01-T14_evaluation_run.png', 'Screenshot 3 — Tests T01–T14: the test suite run inside the deployed app')}

{claude_section()}
## Known limitations and what we will try next

1. **Hinglish outside the built-in vocabulary (holdout H05 failed).** The keyword evidence check does not know words like
   *raat* (night) or *baje* (o'clock), so it declined a question it could answer. Next: an LLM query-rewriting step before
   retrieval, or multilingual embeddings.
2. **Thresholds tuned on the test set.** The evidence and ambiguity rules were adjusted while looking at the 14 main tests.
   Next: tune on a separate development set and keep the holdout set for reporting only.
3. **Sample documents, not official ones.** The bundled policies are labelled samples written for demonstration. Next:
   index Bennett's public Examination Manual (source noted in `docs/policy_sources.md`) and other public documents,
   write tests against them and re-run.
4. **No OCR and no document dates.** Scanned notices are rejected, and a newer notice cannot yet be shown as superseding
   an older clause. In demo mode, conflicts are only detected between money amounts. Next: an OCR fallback and document
   effective dates.
5. **One live run, temperature not under our control.** The Claude comparison (run 3) has one repeat, so consistency was
   not measured, and the claude.ai runtime does not let the page set a temperature, so V2's 0.2 and V3's 0 were not
   applied. Outputs do vary: V1's answer to T10 in the Prompt Lab differed from its answer in run 3. The automated check
   also passed V2's Hinglish reply to T09 although the expected output asks for English. Next: 3 repeats through the
   backend with a fixed temperature, and a language check in the test criteria.
"""


def claude_section() -> str:
    if not CLAUDE:
        return ""
    cfgs = CLAUDE["run"]["configs"]
    by = {(r["Config"], r["Test ID"]): r for r in CLAUDE["results"]}
    tests = [r for r in CLAUDE["results"] if r["Config"] == cfgs[0]]

    def cell(r: dict) -> str:
        if r["Pass/Fail"] == "Pass":
            return "Pass"
        why = r["Failure Reasons"].replace("expected clause not among verified citations", "quoted the wrong clause") \
            .replace("status 'Answered', expected Needs Clarification", "answered instead of asking") \
            .replace("status 'Answered', expected Conflicting Evidence", "answered instead of reporting the conflict")
        return f"**Fail** ({esc(why)})"

    rows_ = "\n".join(f"| {t['Test ID']} | {t['Type']} | {short(t['Input'], 60)} | " +
                      " | ".join(cell(by[(c, t['Test ID'])]) for c in cfgs) + " |" for t in tests)
    s = CLAUDE["summary"]["configs"]
    passed = " | ".join(f"**{s[c]['passed']}/{s[c]['tests']}**" for c in cfgs)
    names = {"pass_rate": "Pass rate", "status_accuracy": "Status accuracy", "factual_correctness": "Factual correctness",
             "citation_accuracy": "Citation accuracy", "hallucination_rate": "Hallucination rate (lower is better)",
             "policy_grounding": "Policy grounding", "format_compliance": "Format compliance"}
    mrows = "\n".join(f"| {label} | " + " | ".join(pct(s[c]['metrics'].get(k)) for c in cfgs) + " |" for k, label in names.items())
    head = " | ".join(CONFIG_LABEL.get(c, c) for c in cfgs)
    run = CLAUDE["run"]
    return f"""## Live run with Claude: V1 vs V2 vs V3 (run {run['id']})

Run {run['id']} used **{run['model']}** in the hosted CampusSage page on {run['started_at'][:10]}: the {len(tests)} main
tests, {len(cfgs)} configurations, {run['repeats']} repeat, {len(CLAUDE['results'])} model outputs. V1–V3 are the prompts on
their own with identical retrieval, so only the prompt differs; System is V3 with the guards and citation checks, as
students use it. Pass/fail is decided by the same code as in demo mode. The exported table is in
`{CLAUDE.get('source', 'test-data/evaluation_results/claude_ai/')}`, and the public prototype's Evaluation page shows this run.

| Metric | {head} |
|---|---|---|---|---|
{mrows}

| Test | Type | Input (short) | {head} |
|--|--|------|----|----|----|----|
{rows_}
| | | **Passed** | {passed} |

{img('docs/screenshots/claude_run3_v1_v2_v3_chart.png', 'Screenshot 4 — Run 3 on Claude: pass rate, citation accuracy, format compliance and hallucination rate per configuration (Evaluation page of the deployed app)', '70%')}
{img('docs/screenshots/T10_v1_vs_v3_claude.png', 'Screenshot 5 — Test T10 on Claude in the Prompt Lab: V1 (top) decides by itself and has no Status field; V3 (bottom) reports Conflicting Evidence with both quotations verified', '78%')}
"""


def repository() -> str:
    return f"""# 5 Repository

{INP['repository_link']}

{img('docs/screenshots/repository.png', 'Repository: commit history and folder layout', '78%')}

What changed since Milestone 1:

- Replaced the earlier model-free policy workbench (21–22 Nov; kept in history at commit 04ea202) with the full application: FastAPI backend, React frontend with 7 pages, and a hosted build served by GitHub Pages.
- Saved V1 (the Milestone 1 baseline), V2 and V3 of prompt P1 as separate files in `prompts/`, each with the reasons for its changes.
- Added deterministic guards, citation validation and an evidence-capped confidence around the LLM.
- Added {N_TESTS} test inputs with machine-checked criteria, automated metrics, CSV/JSON exports and 8 unit tests.
- Ran V1, V2 and V3 live on Claude (run 3, imported with `scripts/import_claude_run.py`); the public prototype's Evaluation page shows it.
- Dated entries in `CHANGELOG.md`; diagrams, screenshots, the demonstration reel (`docs/demo/`) and the Milestone 2 documents in `docs/`.
"""


def tech_report_body() -> str:
    llm_rows = ""
    if LLM:
        for v, m in LLM["metrics"].items():
            passed = LLM.get("passed", {}).get(v) or pct(m.get("pass_rate"))
            label = {"system": "Full system", "v1": "V1 prompt alone", "v2": "V2 prompt alone", "v3": "V3 prompt alone"}.get(v, v)
            llm_rows += f"| {label}, main, Claude | {passed} | {pct(m.get('status_accuracy'))} | {pct(m.get('citation_accuracy'))} | {pct(m.get('hallucination_rate'))} | {pct(m.get('format_compliance'))} |\n"
    else:
        llm_rows = f"| V1, V2, V3 with Claude | [TO FILL after the Claude run]{{.mark}} | | | | |\n"
    sm, sh = SM.get("metrics", {}), SH.get("metrics", {})
    return f"""**Team Agentic Minds (PE-B01-18) · SCSE4041 Prompt Engineering · Bennett University · Technical report**

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
{INP['model']}, reached through LangChain in the back end. So anyone can try it without a server or API key, we ported
the pipeline to TypeScript (same results on all {N_TESTS} test inputs) and host it on GitHub Pages and claude.ai.

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
We wrote {N_TESTS} test inputs ({N_EDGE} edge or invalid), and code, not our judgement, decides pass or fail. The holdout
questions H01–H08 were written after tuning. To compare prompts fairly, we ran V1, V2 and V3 live on Claude (claude.ai,
24 Nov 2026, one repeat) with the same retrieved excerpts, so only the prompt changed.

| Configuration (main = 14 tests, holdout = 8) | Pass | Status acc. | Citation acc. | Hallucination | Format |
|------------|---|---|---|---|---|
| Full system, main, demo mode | {SM.get('passed', '?')}/{SM.get('tests', '?')} | {pct(sm.get('status_accuracy'))} | {pct(sm.get('citation_accuracy'))} | {pct(sm.get('hallucination_rate'))} | {pct(sm.get('format_compliance'))} |
| Full system, holdout, demo mode | {SH.get('passed', '?')}/{SH.get('tests', '?')} | {pct(sh.get('status_accuracy'))} | {pct(sh.get('citation_accuracy'))} | {pct(sh.get('hallucination_rate'))} | {pct(sh.get('format_compliance'))} |
{llm_rows}
Most of the gain came from the output format and the conflict rule: V1 had no status, answered a vague question
instead of asking and settled the late-fee conflict itself, while V3 passed all fourteen. Eight unit tests also confirm
that a made-up quotation or an invented "60%" is caught and the answer withheld.

## 5. Limitations
We know of five weak spots. Hinglish words outside our small vocabulary still defeat the evidence check (holdout H05
failed). Thresholds were tuned on the main suite, so the holdout score is the fairer estimate. The documents are
labelled samples, not official policy. There is no OCR, and without document dates a newer notice cannot yet replace
an older clause. And the Claude comparison is a single run, with no control over temperature on claude.ai. Next: query
rewriting, a separate development set, repeated runs at a fixed temperature, Bennett's public documents and OCR.
"""


def contribution() -> str:
    rows_ = "\n".join(f"| {m['name']} | {fill(m['enrollment'])} | {fill(m['role'])} | {fill(m['tasks'])} | {fill(m['evidence'])} | {fill(m['percent'])} |"
                      for m in INP["members"])
    return f"""# 7 Team contribution

| Member name | Enrollment no. | Role | Tasks done in Milestone 2 | Evidence | Contribution (%) |
|------|------|-----|-----------|---------|----|
{rows_}
| | | | | **Total** | **100** |
"""


CSS = """
@page { size: A4; margin: 15mm 14mm 16mm 14mm; }
body { font-family: Inter, 'DejaVu Sans', sans-serif; font-size: 9.6pt; line-height: 1.45; color: #0f172a; }
h1 { font-size: 17pt; color: #0b1f3a; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin: 0 0 10px; page-break-before: always; }
h1:first-of-type { page-break-before: avoid; }
h2 { font-size: 12.5pt; color: #0b1f3a; margin: 16px 0 6px; }
h3 { font-size: 11pt; color: #1d3b69; margin: 12px 0 5px; }
p { margin: 5px 0; }
table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 8.2pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th { background: #e8f0fe; color: #0b1f3a; text-align: left; }
th, td { border: 1px solid #cbd5e1; padding: 3px 5px; vertical-align: top; }
pre { background: #f6f8fc; border: 1px solid #e4e9f2; border-radius: 4px; padding: 7px 9px; font-size: 7.3pt; line-height: 1.35;
      white-space: pre-wrap; word-break: break-word; font-family: 'DejaVu Sans Mono', monospace; }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: 8pt; }
figure { margin: 8px 0 12px; text-align: center; page-break-inside: avoid; }
figure img { max-width: 100%; border: 1px solid #e4e9f2; }
figcaption { font-size: 8.3pt; color: #475467; margin-top: 3px; }
mark { background: #fde68a; padding: 0 2px; }
em { color: #334155; }
"""

TR_CSS = CSS + """
@page { margin: 12mm 13mm 12mm 13mm; }
body { font-size: 9pt; line-height: 1.38; }
h2 { font-size: 10.5pt; margin: 9px 0 3px; }
table { font-size: 8pt; }
"""


def render(md_text: str, stem: str, title: str, css: str) -> None:
    md_path = M2 / f"{stem}.md"
    md_path.write_text(md_text, encoding="utf-8")
    common = ["--resource-path", str(ROOT), "-f", "markdown+pipe_tables+bracketed_spans+implicit_figures"]
    subprocess.run(["pandoc", str(md_path), *common, "-o", str(M2 / f"{stem}.docx")], check=True)
    with tempfile.TemporaryDirectory() as tmp:
        html = Path(tmp) / "doc.html"
        css_path = Path(tmp) / "doc.css"
        css_path.write_text(css, encoding="utf-8")
        subprocess.run(["pandoc", str(md_path), *common, "--standalone", "--embed-resources", "--css", str(css_path),
                        "--metadata", f"pagetitle={title}", "-o", str(html)], check=True)
        js = Path(tmp) / "pdf.cjs"
        js.write_text(f"""
const {{ chromium }} = require({json.dumps(os.environ.get('PLAYWRIGHT_MODULE', '/opt/npm-tools/node_modules/playwright'))});
(async () => {{
  const b = await chromium.launch({{ executablePath: {json.dumps(os.environ.get('CHROME_PATH', '/usr/bin/google-chrome'))}, args: ['--no-sandbox'] }});
  const p = await b.newPage();
  await p.goto('file://{html}', {{ waitUntil: 'networkidle' }});
  await p.pdf({{ path: {json.dumps(str(M2 / f'{stem}.pdf'))}, format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:7px;width:100%;text-align:center;color:#64748b">{title} · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>' }});
  await b.close();
}})();""")
        subprocess.run(["node", str(js)], check=True)
    print("wrote", stem + ".md/.docx/.pdf")


def main() -> None:
    tr = tech_report_body()
    supporting = "# 6 Supporting document\n\nType: **Technical report**, uploaded separately as `AgenticMinds_TechnicalReport.pdf`; same content as below.\n\n" + \
        tr.replace("\n## ", "\n### ")
    m2 = "\n\n".join([cover(), design(), implementation(), testing(), repository(), supporting, contribution()])
    render(m2, "M2_PE-B01-18_CampusSage", "M2 PE-B01-18 CampusSage", CSS)
    render("# CampusSage — Technical Report\n\n" + tr, "AgenticMinds_TechnicalReport", "Agentic Minds · Technical report", TR_CSS)
    todo = len(re.findall(r"TO FILL", m2))
    print(f"tests={N_TESTS} (edge/invalid {N_EDGE}), passed={N_PASS}; highlighted TO FILL items in the M2 document: {todo}")


if __name__ == "__main__":
    main()
