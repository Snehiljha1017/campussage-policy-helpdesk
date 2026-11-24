"""Export everything the hosted (in-browser) build needs into data.generated.json:
sample-document clauses (chunked by the real backend chunker), test suites,
prompt files and scikit-learn's English stop-word list.

Run from the repository root:  python frontend/hosted/export_data.py
"""
import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["CAMPUSSAGE_DB_PATH"] = str(Path(tempfile.mkdtemp()) / "export.db")
os.environ["CAMPUSSAGE_DATA_DIR"] = tempfile.mkdtemp()
os.environ["VECTOR_BACKEND"] = "tfidf"

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS  # noqa: E402

from database import db  # noqa: E402
from document_processing.ingest import load_samples  # noqa: E402

load_samples()
docs = db.rows("SELECT id, title, filename, category, pages, chunk_count, char_count, status_detail FROM documents ORDER BY id")
for d in docs:
    d["chunks"] = db.rows("SELECT seq, section, heading, page, text FROM chunks WHERE document_id=? ORDER BY seq", (d["id"],))

data = {
    "documents": docs,
    "test_cases": json.loads((ROOT / "test-data/inputs/test_cases.json").read_text(encoding="utf-8"))["cases"],
    "holdout_cases": json.loads((ROOT / "test-data/inputs/holdout_cases.json").read_text(encoding="utf-8"))["cases"],
    "prompts": {vid: (ROOT / "prompts" / rel).read_text(encoding="utf-8") for vid, rel in {
        "v1": "v1/P1_policy_answer_v1.md", "v2": "v2/P1_policy_answer_v2.md",
        "v3": "v3/P1_policy_answer_v3.md", "final": "final/P1_policy_answer.md"}.items()},
    "prompt_sources": {"v1": "prompts/v1/P1_policy_answer_v1.md", "v2": "prompts/v2/P1_policy_answer_v2.md",
                       "v3": "prompts/v3/P1_policy_answer_v3.md", "final": "prompts/final/P1_policy_answer.md"},
    "sklearn_stop_words": sorted(ENGLISH_STOP_WORDS),
    "imported_runs": [],
}
# The latest recorded backend run of each suite, so the hosted Evaluation page shows real past results.
res_dir = ROOT / "test-data" / "evaluation_results"
for suite in ("main", "holdout"):
    files = sorted(p for p in res_dir.glob(f"run*_{suite}_*.json"))
    if files:
        run = json.loads(files[-1].read_text(encoding="utf-8"))
        data["imported_runs"].append({"file": f"test-data/evaluation_results/{files[-1].name}", "run": run["run"],
                                      "summary": run["summary"], "results": run["results"]})
out = Path(__file__).with_name("data.generated.json")
out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("wrote", out.relative_to(ROOT), sum(len(d["chunks"]) for d in docs), "clauses")
