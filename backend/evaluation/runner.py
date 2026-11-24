"""Run the test suite against the real implementation and store every output.

Configurations
  system  - the production chat pipeline: deterministic guards + FINAL prompt
            (= V3) + citation validation. Runs in demo mode too.
  v1/v2/v3/custom-N - prompt-only evaluation: same retrieval + citation
            validation, no guards, so prompt differences are measurable.
            Requires an LLM API key (skipped, with a reason, in demo mode).

CLI (from backend/):
    python -m evaluation.runner                       # system config
    python -m evaluation.runner --configs system v1 v2 v3 --repeats 3
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import threading
import traceback
from datetime import datetime

import config
from database import db
from evaluation.metrics import evaluate_case, summarise
from rag import llm
from rag.pipeline import run as run_pipeline

log = logging.getLogger("campussage.eval")


SUITES = {"main": config.TEST_CASES_PATH, "holdout": config.TEST_CASES_PATH.with_name("holdout_cases.json")}


def load_cases(suite: str = "main") -> list[dict]:
    return json.loads(SUITES[suite].read_text(encoding="utf-8"))["cases"]


def _runnable(configs: list[str]) -> tuple[list[str], dict[str, str]]:
    ok, skipped = [], {}
    for c in configs:
        if c != "system" and not llm.available():
            skipped[c] = "needs an LLM API key (prompt versions cannot be compared in demo mode)"
        else:
            ok.append(c)
    return ok, skipped


def start_run(configs: list[str], repeats: int = 1, suite: str = "main") -> int:
    configs = list(dict.fromkeys(configs)) or ["system"]
    repeats = max(1, min(int(repeats), 5))
    runnable, _ = _runnable(configs)
    total = len(runnable) * repeats * len(load_cases(suite))
    return db.execute(
        "INSERT INTO eval_runs (configs, mode, model, repeats, suite, status, progress, total, started_at) "
        "VALUES (?,?,?,?,?, 'running', 0, ?, ?)",
        (db.dumps(configs), llm.provider(), llm.model_name(), repeats, suite, total, db.now()),
    )


def execute_run(run_id: int) -> dict:
    run = db.one("SELECT * FROM eval_runs WHERE id=?", (run_id,))
    configs = db.loads(run["configs"], ["system"])
    repeats = run["repeats"]
    cases = load_cases(run["suite"])
    runnable, skipped = _runnable(configs)
    records = []
    done = 0
    try:
        for cfg in runnable:
            for rep in range(repeats):
                for case in cases:
                    if cfg == "system":
                        result = run_pipeline(case["input"], version_id="final", guards_on=True, record=False)
                    else:
                        result = run_pipeline(case["input"], version_id=cfg, guards_on=False, record=False,
                                              allow_demo=False)
                    checks = evaluate_case(case, result)
                    cited = [f"{e['category']}:{e['section']}" for e in result.get("evidence", []) if e.get("verified")]
                    records.append({"config": cfg, "test_id": case["id"], "test_type": case["type"],
                                    "repeat_idx": rep, "status": result.get("status"), "cited": cited,
                                    "checks": checks})
                    db.execute(
                        "INSERT INTO eval_results (run_id, config, test_id, repeat_idx, test_type, input, expected, "
                        "actual_status, actual_answer, retrieved_doc, cited_source, citation_correct, passed, "
                        "checks_json, raw_output, latency_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (run_id, cfg, case["id"], rep, case["type"], case["input"], case["expected_output"],
                         result.get("status"), result.get("answer"), checks["retrieved_doc"], checks["cited_source"],
                         None if checks["citation_correct"] is None else int(checks["citation_correct"]),
                         int(checks["passed"]), db.dumps(checks), result.get("raw_output"), result.get("latency_ms")),
                    )
                    done += 1
                    db.execute("UPDATE eval_runs SET progress=? WHERE id=?", (done, run_id))
        summary = {"configs": summarise(records), "skipped": skipped, "mode": run["mode"], "model": run["model"],
                   "demo_mode": run["mode"] == "demo"}
        db.execute("UPDATE eval_runs SET status='completed', summary_json=?, finished_at=? WHERE id=?",
                   (db.dumps(summary), db.now(), run_id))
        summary["files"] = export_files(run_id)
        return summary
    except Exception as exc:
        log.exception("Evaluation run %s failed", run_id)
        db.execute("UPDATE eval_runs SET status='failed', error=?, finished_at=? WHERE id=?",
                   (f"{exc}\n{traceback.format_exc()[-1500:]}", db.now(), run_id))
        raise


def run_in_background(configs: list[str], repeats: int = 1, suite: str = "main") -> int:
    run_id = start_run(configs, repeats, suite)
    threading.Thread(target=lambda: _safe(run_id), daemon=True).start()
    return run_id


def _safe(run_id: int) -> None:
    try:
        execute_run(run_id)
    except Exception:
        pass


# ---- exports -----------------------------------------------------------------
CSV_COLUMNS = ["Config", "Repeat", "Test ID", "Input", "Type", "Expected Output", "Actual Status", "Actual Output",
               "Retrieved Document", "Cited Source", "Citation Correct", "Pass/Fail", "Failure Reasons"]


def result_rows(run_id: int) -> list[dict]:
    out = []
    for r in db.rows("SELECT * FROM eval_results WHERE run_id=? ORDER BY config, repeat_idx, test_id", (run_id,)):
        checks = db.loads(r["checks_json"], {})
        out.append({
            "Config": r["config"], "Repeat": r["repeat_idx"] + 1, "Test ID": r["test_id"], "Input": r["input"],
            "Type": r["test_type"], "Expected Output": r["expected"], "Actual Status": r["actual_status"],
            "Actual Output": r["actual_answer"], "Retrieved Document": r["retrieved_doc"],
            "Cited Source": r["cited_source"],
            "Citation Correct": {None: "n/a", 1: "Yes", 0: "No"}[r["citation_correct"]],
            "Pass/Fail": "Pass" if r["passed"] else "Fail", "Failure Reasons": "; ".join(checks.get("reasons", [])),
        })
    return out


def export_files(run_id: int) -> dict:
    run = db.one("SELECT * FROM eval_runs WHERE id=?", (run_id,))
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = f"run{run_id:03d}_{run['suite']}_{run['mode']}_{stamp}"
    rows = result_rows(run_id)
    csv_path = config.OUTPUTS_DIR / f"{base}_outputs.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        w.writeheader()
        w.writerows(rows)
    raw = db.rows("SELECT config, test_id, repeat_idx, raw_output, checks_json FROM eval_results WHERE run_id=?", (run_id,))
    json_path = config.RESULTS_DIR / f"{base}.json"
    json_path.write_text(json.dumps({
        "run": {k: run[k] for k in ("id", "suite", "mode", "model", "repeats", "started_at", "finished_at")} | {
            "configs": db.loads(run["configs"])},
        "summary": db.loads(run["summary_json"]),
        "results": rows,
        "raw_outputs": [{**r, "checks_json": db.loads(r["checks_json"])} for r in raw],
    }, indent=2, ensure_ascii=False), encoding="utf-8")
    md_path = config.RESULTS_DIR / f"{base}_table.md"
    md_path.write_text(markdown_table(run_id), encoding="utf-8")
    return {"csv": str(csv_path), "json": str(json_path), "markdown": str(md_path)}


def markdown_table(run_id: int) -> str:
    run = db.one("SELECT * FROM eval_runs WHERE id=?", (run_id,))
    summary = db.loads(run["summary_json"], {})
    lines = [f"# Evaluation run {run_id} - suite: {run['suite']} - mode: {run['mode']}" + (f" ({run['model']})" if run["model"] else ""),
             "", f"Started {run['started_at']}, finished {run['finished_at']}. Repeats: {run['repeats']}.", ""]
    if run["mode"] == "demo":
        lines += ["> DEMO MODE: no LLM was called. Answers were produced by the extractive demo answerer. "
                  "Re-run with an API key for the Milestone 2 table.", ""]
    for cfg, s in (summary.get("configs") or {}).items():
        m = s["metrics"]
        lines += [f"## Config `{cfg}`: {s['passed']}/{s['tests']} passed", "",
                  "| Metric | Value |", "|---|---|"]
        lines += [f"| {k.replace('_', ' ').title()} | {'n/a' if v is None else f'{v:.0%}'} |" for k, v in m.items()]
        lines += ["", "| Test no. | Input (short) | Type | Expected output | Actual output (short) | Pass / Fail |",
                  "|---|---|---|---|---|---|"]
        for r in result_rows(run_id):
            if r["Config"] != cfg or r["Repeat"] != 1:
                continue
            actual = f"{r['Actual Status']}: {(r['Actual Output'] or '').replace(chr(10), ' ')[:110]}"
            lines.append(f"| {r['Test ID']} | {r['Input'][:60]} | {r['Type']} | {r['Expected Output'][:90]} | "
                         f"{actual.replace('|', '/')} | {r['Pass/Fail']}" + (f" ({r['Failure Reasons']})" if r['Failure Reasons'] else "") + " |")
        lines.append("")
    for cfg, why in (summary.get("skipped") or {}).items():
        lines.append(f"- `{cfg}` skipped: {why}")
    return "\n".join(lines) + "\n"


def main() -> None:
    logging.basicConfig(level=logging.WARNING)
    ap = argparse.ArgumentParser(description="Run the CampusSage test suite")
    ap.add_argument("--configs", nargs="+", default=["system"], help="system v1 v2 v3 custom-N")
    ap.add_argument("--repeats", type=int, default=1, help="runs per test (for the consistency metric)")
    ap.add_argument("--suite", choices=list(SUITES), default="main", help="main (14 tests) or holdout (8 tests)")
    args = ap.parse_args()

    from document_processing.ingest import load_index_from_db, load_samples
    load_index_from_db()
    if not db.one("SELECT id FROM documents WHERE status='indexed' LIMIT 1"):
        load_samples()
    run_id = start_run(args.configs, args.repeats, args.suite)
    print(f"Run {run_id}: suite={args.suite} mode={llm.provider()} model={llm.model_name()} "
          f"configs={args.configs} repeats={args.repeats}")
    summary = execute_run(run_id)
    for cfg, s in summary["configs"].items():
        m = s["metrics"]
        print(f"\n[{cfg}] {s['passed']}/{s['tests']} passed")
        for k, v in m.items():
            print(f"  {k:20s} {'n/a' if v is None else f'{v:.0%}'}")
    for cfg, why in summary["skipped"].items():
        print(f"\n[{cfg}] SKIPPED - {why}")
    print("\nFiles:", json.dumps(summary["files"], indent=2))


if __name__ == "__main__":
    main()
