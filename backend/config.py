"""Central configuration. Every value can be overridden with an environment variable.

API keys are read from the environment only (see ../.env.example). They are
never sent to the frontend and never written to the database.
"""
from __future__ import annotations

import os
from pathlib import Path

try:  # optional: load backend/.env or repo-root .env during local development
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # python-dotenv is optional
    pass

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent

DATA_DIR = Path(os.getenv("CAMPUSSAGE_DATA_DIR", BACKEND_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = Path(os.getenv("CAMPUSSAGE_DB_PATH", DATA_DIR / "campussage.db"))
CHROMA_DIR = DATA_DIR / "chroma"

PROMPTS_DIR = Path(os.getenv("CAMPUSSAGE_PROMPTS_DIR", ROOT_DIR / "prompts"))
SAMPLE_DOCS_DIR = ROOT_DIR / "sample-documents"
TEST_CASES_PATH = ROOT_DIR / "test-data" / "inputs" / "test_cases.json"
RESULTS_DIR = ROOT_DIR / "test-data" / "evaluation_results"
OUTPUTS_DIR = ROOT_DIR / "test-data" / "outputs"

# ---- LLM -------------------------------------------------------------------
# LLM_PROVIDER: "openai" (also any OpenAI-compatible endpoint via OPENAI_BASE_URL),
# "anthropic", or "demo". When unset we pick "openai" if OPENAI_API_KEY exists,
# else "anthropic" if ANTHROPIC_API_KEY exists, else the labelled demo mode.
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "") or None
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5")
LLM_TIMEOUT_S = float(os.getenv("LLM_TIMEOUT_S", "60"))


def resolve_provider() -> str:
    explicit = os.getenv("LLM_PROVIDER", "").strip().lower()
    if explicit in {"openai", "anthropic", "demo"}:
        return explicit
    if OPENAI_API_KEY:
        return "openai"
    if ANTHROPIC_API_KEY:
        return "anthropic"
    return "demo"


# ---- Retrieval ---------------------------------------------------------------
# VECTOR_BACKEND: "auto" uses ChromaDB + sentence-transformers when both are
# installed, otherwise the local TF-IDF index (works with only scikit-learn).
VECTOR_BACKEND = os.getenv("VECTOR_BACKEND", "auto").lower()
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
TOP_K = int(os.getenv("TOP_K", "5"))
MAX_CHUNK_CHARS = int(os.getenv("MAX_CHUNK_CHARS", "900"))

# Frontend origins allowed by CORS (comma separated). "*" is fine for local dev.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "15"))

for _d in (DATA_DIR, UPLOAD_DIR, RESULTS_DIR, OUTPUTS_DIR):
    _d.mkdir(parents=True, exist_ok=True)
