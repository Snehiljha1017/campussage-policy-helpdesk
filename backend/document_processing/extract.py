"""PDF text extraction. PyMuPDF is the primary extractor (fast, keeps reading
order); pypdf is a pure-Python fallback so the app still works without it."""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ExtractedDoc:
    pages: list[str]          # cleaned text per page
    extractor: str            # "pymupdf" | "pypdf" | "text"

    @property
    def text(self) -> str:
        return "\n".join(self.pages)


def _extract_raw(path: Path) -> tuple[list[str], str]:
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md"}:
        return [path.read_text(encoding="utf-8", errors="ignore")], "text"
    try:
        import fitz  # PyMuPDF

        with fitz.open(path) as pdf:
            return [page.get_text("text") for page in pdf], "pymupdf"
    except ImportError:
        pass
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    return [(page.extract_text() or "") for page in reader.pages], "pypdf"


def _strip_boilerplate(pages: list[str]) -> list[str]:
    """Remove repeated header/footer lines (e.g. a banner printed on every page),
    so they don't leak into the clause text that gets quoted back to students."""
    counts: Counter[str] = Counter()
    for p in pages:
        counts.update(line.strip() for line in p.splitlines() if line.strip())
    boiler = {line for line, n in counts.items() if n >= 2 and len(line) > 30}
    cleaned = []
    for p in pages:
        lines = [ln for ln in p.splitlines() if ln.strip() not in boiler]
        cleaned.append("\n".join(lines))
    return cleaned


def extract_pdf(path: str | Path) -> ExtractedDoc:
    path = Path(path)
    pages, extractor = _extract_raw(path)
    pages = _strip_boilerplate(pages)
    if not any(p.strip() for p in pages):
        raise ValueError(
            "No extractable text found. The PDF may be a scanned image; OCR is not supported yet."
        )
    return ExtractedDoc(pages=pages, extractor=extractor)
