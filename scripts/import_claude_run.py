"""Turn the Markdown table exported from a hosted (claude.ai) evaluation run into the JSON format the backend
writes, so the documents generator and the public build can use it.

    python scripts/import_claude_run.py test-data/evaluation_results/claude_ai/<run>_table.md

The Markdown export is the source of truth. It holds every metric and every pass/fail verdict, but each output is
shortened to about 120 characters and the retrieved/cited sources are not included. Inputs and expected outputs are
restored in full from test-data/inputs/test_cases.json. Nothing else is added or changed.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUSES = ("Needs Clarification", "Conflicting Evidence", "Not Covered", "Answered")
METRICS = {"pass rate": "pass_rate", "status accuracy": "status_accuracy", "factual correctness": "factual_correctness",
           "citation accuracy": "citation_accuracy", "hallucination rate": "hallucination_rate",
           "policy grounding": "policy_grounding", "format compliance": "format_compliance", "consistency": "consistency"}


def pct(v: str):
    v = v.strip()
    return None if v == "n/a" else int(v.rstrip("%")) / 100


def parse(md: str) -> dict:
    head = re.search(r"^# Evaluation run (\d+) - suite: (\w+) - mode: (\w+) \((.+)\)$", md, re.M)
    times = re.search(r"Started (\S+), finished (\S+)\. Repeats: (\d+)\.", md)
    if not head or not times:
        raise SystemExit("Not a CampusSage evaluation export (header line missing).")
    run_id, suite, mode, model = int(head[1]), head[2], head[3], head[4]
    cases = {c["id"]: c for c in json.loads((ROOT / "test-data/inputs/test_cases.json").read_text(encoding="utf-8"))["cases"]}
    cases |= {c["id"]: c for c in json.loads((ROOT / "test-data/inputs/holdout_cases.json").read_text(encoding="utf-8"))["cases"]}

    configs, summary, results = [], {}, []
    for block in re.split(r"^## Config `", md, flags=re.M)[1:]:
        cfg = block.split("`", 1)[0]
        configs.append(cfg)
        metrics = {key: pct(m[1]) for name, key in METRICS.items()
                   if (m := re.search(rf"^\| {name} \| ([^|]+) \|$", block, re.M))}
        rows = []
        for line in block.splitlines():
            m = re.match(r"^\| ([TH]\d\d) \| (.*) \| (Normal|Edge|Invalid) \| (.*) \| (.*) \| (Pass|Fail)(?: \((.*)\))? \|$", line)
            if not m:
                continue
            tid, _, typ, _, actual, verdict, reasons = m.groups()
            status = next((s for s in STATUSES if actual.startswith(s + ":")), "")
            case = cases.get(tid, {})
            rows.append({"Config": cfg, "Repeat": 1, "Test ID": tid, "Input": case.get("input", ""), "Type": typ,
                         "Expected Output": case.get("expected_output", ""), "Actual Status": status,
                         "Actual Output": actual[len(status) + 2:] + " …" if status else actual,
                         "Retrieved Document": "", "Cited Source": "", "Citation Correct": "n/a",
                         "Pass/Fail": verdict, "Failure Reasons": reasons or ""})
        by_type: dict = {}
        for r in rows:
            t = by_type.setdefault(r["Type"], {"total": 0, "passed": 0})
            t["total"] += 1
            t["passed"] += r["Pass/Fail"] == "Pass"
        passed = sum(r["Pass/Fail"] == "Pass" for r in rows)
        summary[cfg] = {"tests": len(rows), "outputs": len(rows), "repeats": 1, "passed": passed,
                        "failed": len(rows) - passed, "by_type": by_type, "metrics": metrics}
        results += rows
    return {
        "run": {"id": run_id, "suite": suite, "mode": mode, "model": model, "repeats": int(times[3]),
                "started_at": times[1], "finished_at": times[2], "configs": configs},
        "summary": {"configs": summary, "skipped": {}, "mode": mode, "model": model, "demo_mode": False},
        "results": results,
        "note": "Imported from the Markdown export of this run (hosted CampusSage page on claude.ai). "
                "Outputs are shortened to about 120 characters by that export; retrieved and cited sources are not included.",
    }


def main() -> None:
    src = Path(sys.argv[1])
    data = parse(src.read_text(encoding="utf-8"))
    data["source"] = str(src.resolve().relative_to(ROOT))
    out = src.with_name(src.name.replace("_table.md", ".json"))
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    for cfg, s in data["summary"]["configs"].items():
        print(f"{cfg:7s} {s['passed']}/{s['tests']}  " + "  ".join(f"{k}={v}" for k, v in s["metrics"].items()))
    print("wrote", out.resolve().relative_to(ROOT))


if __name__ == "__main__":
    main()
