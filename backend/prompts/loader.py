"""Load prompt versions from the repository's prompts/ folder (single source of
truth) plus custom versions created in the Prompt Lab editor (SQLite)."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from pathlib import Path

from config import PROMPTS_DIR
from database import db
from rag.vector_store import Hit

BUILTIN_FILES = {
    "v1": "v1/P1_policy_answer_v1.md",
    "v2": "v2/P1_policy_answer_v2.md",
    "v3": "v3/P1_policy_answer_v3.md",
    "final": "final/P1_policy_answer.md",
}


@dataclass
class PromptVersion:
    id: str
    name: str
    system_prompt: str | None
    user_template: str
    temperature: float | None
    source: str                 # file path or "custom"
    notes: str = ""
    builtin: bool = True
    created_at: str | None = None
    base_version: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def _block_after(heading: str, text: str) -> str:
    m = re.search(rf"^##\s+{re.escape(heading)}\s*\n+```[a-z]*\n(.*?)\n```", text, re.MULTILINE | re.DOTALL)
    if not m:
        raise ValueError(f"Section '## {heading}' with a fenced block not found")
    return m.group(1)


def _parse_file(vid: str, path: Path) -> PromptVersion:
    text = path.read_text(encoding="utf-8")
    meta: dict[str, str] = {}
    fm = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if fm:
        for line in fm.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
    system = _block_after("System Prompt", text).strip()
    temp_raw = meta.get("temperature", "default")
    temperature = None if temp_raw in {"", "default", "none"} else float(temp_raw)
    why = re.search(r"^## What changed.*?\n(.*?)(?=^## System Prompt)", text, re.MULTILINE | re.DOTALL)
    return PromptVersion(
        id=vid, name=meta.get("name", vid), system_prompt=None if system.lower() == "none" else system,
        user_template=_block_after("User Prompt Template", text).strip(), temperature=temperature,
        source=str(path.relative_to(PROMPTS_DIR.parent)), notes=(why.group(1).strip() if why else ""),
    )


def list_versions(include_final: bool = False) -> list[PromptVersion]:
    out = []
    for vid, rel in BUILTIN_FILES.items():
        if vid == "final" and not include_final:
            continue
        path = PROMPTS_DIR / rel
        if path.exists():
            out.append(_parse_file(vid, path))
    for r in db.rows("SELECT * FROM prompt_versions ORDER BY created_at"):
        out.append(PromptVersion(
            id=r["id"], name=r["name"], system_prompt=r["system_prompt"] or None,
            user_template=r["user_template"], temperature=r["temperature"], source="custom",
            notes=r["notes"] or "", builtin=False, created_at=r["created_at"], base_version=r["base_version"],
        ))
    return out


def get_version(vid: str) -> PromptVersion:
    for v in list_versions(include_final=True):
        if v.id == vid:
            return v
    raise KeyError(vid)


def save_custom(name: str, system_prompt: str, user_template: str, temperature: float | None,
                base_version: str | None, notes: str) -> PromptVersion:
    if "{question}" not in user_template:
        raise ValueError("The user template must contain the {question} variable.")
    if "{policy_excerpts}" not in user_template and "{policy_text}" not in user_template:
        raise ValueError("The user template must contain {policy_excerpts} (or {policy_text}).")
    n = (db.one("SELECT COUNT(*) AS n FROM prompt_versions") or {"n": 0})["n"] + 1
    vid = f"custom-{n}"
    while db.one("SELECT id FROM prompt_versions WHERE id=?", (vid,)):
        n += 1
        vid = f"custom-{n}"
    db.execute(
        "INSERT INTO prompt_versions (id, name, base_version, system_prompt, user_template, temperature, notes, created_at)"
        " VALUES (?,?,?,?,?,?,?,?)",
        (vid, name.strip() or vid, base_version, system_prompt, user_template, temperature, notes, db.now()),
    )
    return get_version(vid)


def format_excerpts(hits: list[Hit]) -> str:
    blocks = []
    for i, h in enumerate(hits, start=1):
        c = h.chunk
        head = f"[E{i}] {c.title} - Section {c.section}" + (f" ({c.heading})" if c.heading else "")
        blocks.append(f"{head}\n{c.text}")
    return "\n\n".join(blocks) if blocks else "(no excerpts were retrieved)"


def render(version: PromptVersion, question: str, hits: list[Hit]) -> tuple[str | None, str]:
    excerpts = format_excerpts(hits)
    # str.replace, not str.format: prompts may legitimately contain braces.
    user = version.user_template.replace("{policy_excerpts}", excerpts).replace("{policy_text}", excerpts)
    user = user.replace("{question}", question.strip())
    return version.system_prompt, user
