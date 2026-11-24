// Port of backend/rag/text_utils.py. Keep the two files in sync.

const words = (s: string) => new Set(s.trim().split(/\s+/));

export const STOPWORDS = words(`a an the is are was were be been being am do does did doing have has had having i me my mine we our us you your
he she it they them their what which who whom whose this that these those of to in on at by for with about against
between into through during before after above below from up down out off over under again further then once here
there when where why how all any both each few more most other some such no nor not only own same so than too very
can will just should could would may might must shall also if or and but as until while per tell please know want
need get got give let s t don dont ill im ive isnt arent cant since much many anyone someone something`);

export const HINGLISH_STOPWORDS = words(`kya kyu kyun kaise kab kahan kitna kitni kitne hai hain tha thi the ho hota hoti hote ke ki ka ko se me mein mai main
mujhe mera meri mere hum humko hamara apna apni aap tum tera teri liye chahiye chaiye chahie dena dene deni karna karne
kar kare karo raha rahi rahe sakta sakti sakte agar toh to bhi aur ya nahi nahin na hi ek koi kuch sab wala wali wale
bata batao bataiye jaana jana milega milegi lagega lagegi pe par tak`);

export const DOMAIN_GENERIC = words(`student students university policy policies rule rules regulation regulations semester campus bennett allowed
permitted required requirement requirements minimum maximum maximum official`);

const SYNONYMS: [RegExp, string][] = [
  [/\bend[\s-]?sem(?:ester)?s?\b/g, "end-semester examination"],
  [/\bmid[\s-]?sem(?:ester)?s?\b/g, "mid-semester examination"],
  [/\bexams?\b/g, "examination"],
  [/\battendence\b/g, "attendance"],
  [/\bhostle\b/g, "hostel"],
  [/\bfees\b/g, "fee"],
  [/\breval(?:uation)?\b/g, "re-evaluation"],
  [/\brecheck(?:ing)?\b/g, "re-evaluation"],
  [/\bcurfew\b/g, "return to the hostel by in-time"],
  [/\bdebar(?:red)?\b/g, "debarred"],
  [/\bdeadline\b/g, "deadline last date due date"],
];

const NUM_RE = /(?:rs\.?|inr|₹)\s?\d[\d,]*(?:\.\d+)?|\d+(?:\.\d+)?\s?%|\b\d{1,2}:\d{2}\s?(?:am|pm)?\b|\b\d[\d,]*(?:\.\d+)?\b/gi;
const TOKEN_RE = /[a-z0-9]+(?:-[a-z0-9]+)*/g;

export function normalise(text: string): string {
  return text.normalize("NFKC").replace(/’/g, "'").replace(/“/g, '"').replace(/”/g, '"').replace(/–/g, "-").replace(/—/g, "-")
    .replace(/\s+/g, " ").trim();
}

export function expandQuery(q: string): string {
  let out = q.toLowerCase();
  for (const [pat, rep] of SYNONYMS) out = out.replace(pat, rep);
  return out;
}

export function tokens(text: string): string[] {
  const out: string[] = [];
  for (const t of text.toLowerCase().match(TOKEN_RE) ?? []) {
    out.push(t);
    if (t.includes("-")) out.push(...t.split("-").filter(Boolean));
  }
  return out;
}

export function stem(tok: string): string {
  for (const suf of ["ations", "ation", "ings", "ing", "ies", "es", "ed", "s"]) {
    if (tok.length > suf.length + 3 && tok.endsWith(suf)) return tok.slice(0, -suf.length);
  }
  return tok;
}

export function contentTerms(text: string, dropGeneric = true, expand = true): string[] {
  const out: string[] = [];
  for (const t of tokens(expand ? expandQuery(text) : text)) {
    if (STOPWORDS.has(t) || HINGLISH_STOPWORDS.has(t) || t.length < 2) continue;
    if (dropGeneric && DOMAIN_GENERIC.has(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function termCoverage(terms: string[], text: string): number {
  if (!terms.length) return 0;
  const toks = tokens(text);
  const body = new Set(toks.map(stem));
  const bodyStr = toks.join(" ");
  let hit = 0;
  for (const t of terms) {
    const s = stem(t);
    if (body.has(s) || (s.length >= 5 && bodyStr.includes(s))) hit++;
  }
  return hit / terms.length;
}

export function canonNumber(n: string): string {
  return n.toLowerCase().replace(/rs\./g, "").replace(/rs/g, "").replace(/inr/g, "").replace(/₹/g, "").replace(/[\s,]/g, "");
}

export function numbersIn(text: string): Set<string> {
  return new Set([...text.matchAll(NUM_RE)].map((m) => canonNumber(m[0])));
}

export function moneyIn(text: string): Set<string> {
  return new Set([...text.matchAll(/(?:rs\.?|inr|₹)\s?\d[\d,]*/gi)].map((m) => canonNumber(m[0])));
}

export function quoteNorm(text: string): string {
  let t = normalise(text).toLowerCase().replace(/^[ "'“”`.]+|[ "'“”`.]+$/g, "");
  t = t.replace(/₹/g, "rs. ");
  return t.replace(/\s+/g, " ").replace(/[^a-z0-9%:.,; ]/g, "").trim();
}

export const pct0 = (x: number) => `${Math.round(x * 100)}%`;
