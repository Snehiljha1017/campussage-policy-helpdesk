"""Text normalisation shared by retrieval, the guards and the evaluator."""
from __future__ import annotations

import re
import unicodedata

STOPWORDS = set("""
a an the is are was were be been being am do does did doing have has had having i me my mine we our us you your
he she it they them their what which who whom whose this that these those of to in on at by for with about against
between into through during before after above below from up down out off over under again further then once here
there when where why how all any both each few more most other some such no nor not only own same so than too very
can will just should could would may might must shall also if or and but as until while per tell please know want
need get got give let s t don dont ill im ive isnt arent cant since much many anyone someone something
""".split())

# Common Hinglish function words (romanised Hindi), so "exam dene ke liye kitni
# attendance chahiye" reduces to its content words: exam, attendance.
HINGLISH_STOPWORDS = set("""
kya kyu kyun kaise kab kahan kitna kitni kitne hai hain tha thi the ho hota hoti hote ke ki ka ko se me mein mai main
mujhe mera meri mere hum humko hamara apna apni aap tum tera teri liye chahiye chaiye chahie dena dene deni karna karne
kar kare karo raha rahi rahe sakta sakti sakte agar toh to bhi aur ya nahi nahin na hi ek koi kuch sab wala wali wale
bata batao bataiye jaana jana milega milegi lagega lagegi pe par tak
""".split())

# Words that appear in nearly every policy and say little about *which* policy.
DOMAIN_GENERIC = set("""
student students university policy policies rule rules regulation regulations semester campus bennett allowed
permitted required requirement requirements minimum maximum maximum official
""".split())

# Light normalisation of student shorthand before retrieval.
SYNONYMS = {
    r"\bend[\s-]?sem(?:ester)?s?\b": "end-semester examination",
    r"\bmid[\s-]?sem(?:ester)?s?\b": "mid-semester examination",
    r"\bexams?\b": "examination",
    r"\battendence\b": "attendance",
    r"\bhostle\b": "hostel",
    r"\bfees\b": "fee",
    r"\breval(?:uation)?\b": "re-evaluation",
    r"\brecheck(?:ing)?\b": "re-evaluation",
    r"\bcurfew\b": "return to the hostel by in-time",
    r"\bdebar(?:red)?\b": "debarred",
    r"\bdeadline\b": "deadline last date due date",
}

NUM_RE = re.compile(
    r"(?:rs\.?|inr|₹)\s?\d[\d,]*(?:\.\d+)?|\d+(?:\.\d+)?\s?%|\b\d{1,2}:\d{2}\s?(?:am|pm)?\b|\b\d[\d,]*(?:\.\d+)?\b",
    re.IGNORECASE,
)
TOKEN_RE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def normalise(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("’", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", text).strip()


def expand_query(q: str) -> str:
    out = q.lower()
    for pat, rep in SYNONYMS.items():
        out = re.sub(pat, rep, out)
    return out


def tokens(text: str) -> list[str]:
    out = []
    for t in TOKEN_RE.findall(text.lower()):
        out.append(t)
        if "-" in t:                      # "in-time" -> also "in", "time"
            out.extend(p for p in t.split("-") if p)
    return out


def stem(tok: str) -> str:
    """Tiny suffix stripper: enough to match fee/fees, condone/condonation."""
    for suf in ("ations", "ation", "ings", "ing", "ies", "es", "ed", "s"):
        if len(tok) > len(suf) + 3 and tok.endswith(suf):
            return tok[: -len(suf)]
    return tok


def content_terms(text: str, drop_generic: bool = True, expand: bool = True) -> list[str]:
    out = []
    for t in tokens(expand_query(text) if expand else text):
        if t in STOPWORDS or t in HINGLISH_STOPWORDS or len(t) < 2:
            continue
        if drop_generic and t in DOMAIN_GENERIC:
            continue
        if t not in out:                  # unique terms, so repeats don't skew coverage
            out.append(t)
    return out


def term_coverage(terms: list[str], text: str) -> float:
    """Fraction of query terms whose stem appears in `text`."""
    if not terms:
        return 0.0
    body = {stem(t) for t in tokens(text)}
    body_str = " ".join(tokens(text))
    hit = 0
    for t in terms:
        s = stem(t)
        if s in body or (len(s) >= 5 and s in body_str):
            hit += 1
    return hit / len(terms)


def canon_number(n: str) -> str:
    n = n.lower().replace("rs.", "").replace("rs", "").replace("inr", "").replace("₹", "")
    return re.sub(r"[\s,]", "", n)


def numbers_in(text: str) -> set[str]:
    """Policy-relevant quantities (money, percentages, times, counts)."""
    return {canon_number(m.group(0)) for m in NUM_RE.finditer(text)}


def money_in(text: str) -> set[str]:
    return {canon_number(m) for m in re.findall(r"(?:rs\.?|inr|₹)\s?\d[\d,]*", text, re.IGNORECASE)}


def quote_norm(text: str) -> str:
    text = normalise(text).lower().strip(" \"'“”`.")
    text = text.replace("₹", "rs. ")
    return re.sub(r"[^a-z0-9%:.,; ]", "", re.sub(r"\s+", " ", text)).strip()
