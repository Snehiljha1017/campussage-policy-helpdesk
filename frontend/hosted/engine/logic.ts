// Port of backend/rag/{guards,rerank,offices,confidence,output_parser,citation,demo_answerer}.py,
// backend/document_processing/{chunker,extract}.py and backend/prompts/loader.py.
import { index, indexText, type Hit } from "./index";
import { contentTerms, moneyIn, numbersIn, pct0, quoteNorm, stem, termCoverage, tokens } from "./text";

/* ================= guards ================= */
export const MAX_QUESTION_CHARS = 1000;
const INJECTION_PATTERNS = [
  /ignore (?:all |any |the )?(?:previous|prior|above|earlier) (?:instructions|rules|prompts?)/,
  /disregard (?:the |all |your )?(?:rules|instructions|system prompt)/,
  /you are now\b/, /act as (?:an? )?(?!student)/, /system prompt/, /jailbreak/,
  /pretend (?:that|to)/, /forget (?:your|the) (?:rules|instructions)/,
];
const PRT = "attendance|marks?|grades?|cgpa|sgpa|results?|fee (?:status|dues)|dues|roll (?:no|number)|enrol(?:l)?ment (?:no|number)|phone(?: number)?|address|email|room number";
const PERSONAL_RE = new RegExp(`\\b([A-Z][a-z]+(?:\\s[A-Z][a-z]+)?)'s\\s+(?:${PRT})\\b|\\b(?:${PRT})\\s+of\\s+(?:student\\s+)?([A-Z][a-z]+(?:\\s[A-Z][a-z]+)?)\\b`);
const AMBIGUOUS_TERMS: Record<string, string> = {
  deadline: "last date due date within days apply", date: "last date due date", fee: "fee charge payment",
  fine: "late fee penalty charge", penalty: "late fee penalty debarred", charge: "fee charge", timing: "time hours AM PM",
  time: "time hours AM PM", leave: "leave absence break night-out", eligibility: "eligible eligibility",
  eligible: "eligible eligibility", process: "apply application procedure", procedure: "apply application procedure",
  form: "apply application", limit: "maximum minimum limit", refund: "refund",
};
export const KEYWORD_SCORE_FLOOR = 0.08;

export interface GuardOutcome { status: string | null; answer: string; clarification: string | null; flags: string[]; detail: string }
const ok = (): GuardOutcome => ({ status: null, answer: "", clarification: null, flags: [], detail: "ok" });

const wordLike = (t: string) => /^\d+$/.test(t) || (/[aeiouy]/.test(t) && !/[^aeiouy0-9]{5,}/.test(t));

export function validateQuestion(question: string): GuardOutcome {
  const q = question.trim();
  if (!q) return { ...ok(), status: "Needs Clarification", answer: "Please type a question about a university policy.", detail: "empty input" };
  if (q.length > MAX_QUESTION_CHARS)
    return { ...ok(), status: "Needs Clarification", answer: `Your question is very long. Please shorten it to under ${MAX_QUESTION_CHARS} characters.`, detail: "too long" };
  const toks = tokens(q);
  if (!toks.length || toks.filter(wordLike).length / toks.length < 0.5)
    return {
      ...ok(), status: "Needs Clarification",
      answer: "I couldn't understand that. Could you rephrase your question about attendance, examinations, fees, hostel or academic rules?",
      clarification: "Could you rephrase your question?", detail: "input does not look like words",
    };
  return ok();
}

export const injectionFlags = (q: string) => (INJECTION_PATTERNS.some((p) => p.test(q.toLowerCase())) ? ["prompt_injection"] : []);

export function stripInjection(question: string): string {
  const parts = question.split(/(?<=[.!?])\s+|\s+and\s+(?=tell|say|state)/);
  const kept = parts.filter((p) => !INJECTION_PATTERNS.some((pat) => pat.test(p.toLowerCase())));
  return kept.join(" ").trim() || question;
}

export function personalDataRequest(question: string): GuardOutcome {
  if (PERSONAL_RE.test(question))
    return {
      ...ok(), status: "Not Covered",
      answer: "I can't share or look up information about individual students. CampusSage only reads published policy documents and has no access to personal records. Students can see their own records on the student portal.",
      flags: ["personal_data_request"], detail: "question asks for another person's record",
    };
  return ok();
}

export function ambiguity(question: string): GuardOutcome {
  const terms = contentTerms(question, true, false);
  const stems = new Set(terms.map(stem));
  const amb = terms.filter((t) => t in AMBIGUOUS_TERMS || stem(t) in AMBIGUOUS_TERMS);
  const specific = terms.filter((t) => !amb.includes(t) && !["last", "much", "many", "when", "whats"].includes(t));
  if (!amb.length || specific.length || stems.size > 2) return ok();
  const term = amb[0];
  const hits = index.search(AMBIGUOUS_TERMS[term] ?? AMBIGUOUS_TERMS[stem(term)] ?? term, 8);
  const options: string[] = [];
  for (const h of hits) {
    const label = `${h.chunk.heading || "Section " + h.chunk.section} (${h.chunk.category})`;
    if (h.score > 0 && !options.includes(label)) options.push(label);
    if (options.length === 4) break;
  }
  const qt = options.length
    ? `Which ${term} do you mean? For example: ${options.join("; ")}.`
    : `Could you tell me which ${term} you are asking about (fees, examinations, attendance or hostel)?`;
  return { status: "Needs Clarification", answer: qt, clarification: qt, flags: ["ambiguous"], detail: `'${term}' alone could refer to several policies` };
}

export interface EvidenceCheck { sufficient: boolean; coverage: number; top_coverage: number; top_score: number; terms: string[]; reason: string }

export function evidenceCheck(question: string, hits: Hit[]): EvidenceCheck {
  let terms = contentTerms(question);
  if (!terms.length) terms = contentTerms(question, false);
  if (!hits.length) return { sufficient: false, coverage: 0, top_coverage: 0, top_score: 0, terms, reason: "no documents indexed" };
  const top = hits[0];
  const cov = termCoverage(terms, hits.slice(0, 3).map((h) => indexText(h.chunk)).join(" "));
  const topCov = termCoverage(terms, indexText(top.chunk));
  const base = { coverage: cov, top_coverage: topCov, top_score: top.score, terms };
  if (top.score < KEYWORD_SCORE_FLOOR) return { ...base, sufficient: false, reason: `top retrieval score ${top.score.toFixed(2)} below ${KEYWORD_SCORE_FLOOR}` };
  if (cov < 0.5) return { ...base, sufficient: false, reason: `retrieved clauses cover only ${pct0(cov)} of the question's key terms` };
  if (topCov < 0.34) return { ...base, sufficient: false, reason: `best clause covers only ${pct0(topCov)} of the key terms (question may combine topics)` };
  return { ...base, sufficient: true, reason: `coverage ${pct0(cov)}, top score ${top.score.toFixed(2)}` };
}

const disjoint = (a: Set<string>, b: Set<string>) => [...a].every((x) => !b.has(x));
const setEq = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

export function detectConflicts(question: string, hits: Hit[]): [Hit, Hit][] {
  const terms = contentTerms(question);
  if (!hits.length || !terms.length) return [];
  const topScore = hits[0].score;
  const cand = hits.slice(0, 4).filter((h) => h.score >= 0.6 * topScore && moneyIn(h.chunk.text).size > 0);
  const covered = new Map(cand.map((h) => [h.chunk.id, new Set(terms.filter((t) => termCoverage([t], indexText(h.chunk)) === 1))]));
  const pairs: [Hit, Hit][] = [];
  cand.forEach((a, i) => {
    for (const b of cand.slice(i + 1)) {
      if (a.chunk.document_id === b.chunk.document_id) continue;
      const ca = covered.get(a.chunk.id)!, cb = covered.get(b.chunk.id)!;
      if (!setEq(ca, cb) || ca.size / terms.length < 0.5) continue;
      if (disjoint(moneyIn(a.chunk.text), moneyIn(b.chunk.text))) pairs.push([a, b]);
    }
  });
  return pairs;
}

/* ================= rerank ================= */
const QUANTITY_Q = /\bhow (?:much|many|long)\b|\bkitn[aie]\b|\bminimum\b|\bmaximum\b|\bpercent|%|\bcost|\bamount\b|\bhow old\b/i;
const TIME_Q = /\bwhat time\b|\bby when\b|\bkab tak\b|\btimings?\b|\bhours\b|\bwhen (?:do|should|must)\b|\bat night\b/i;
const DATE_Q = /\bdeadline\b|\blast date\b|\bdue date\b|\bwhen\b|\bkab\b|\bwithin\b/i;
const HAS_QUANTITY = /\d+\s?%|(?:rs\.?|inr|₹)\s?\d|\b\d+\s+(?:credits?|days?|weeks?|minutes?|semesters?|books?)\b/i;
const HAS_TIME = /\b\d{1,2}:\d{2}\s?(?:am|pm)?\b/i;
const HAS_DATE = /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\bwithin \d+ days\b/i;

function answerTypeBonus(q: string, text: string): number {
  let bonus = 0;
  if (QUANTITY_Q.test(q) && HAS_QUANTITY.test(text)) bonus = 1;
  if (TIME_Q.test(q) && HAS_TIME.test(text)) bonus = 1;
  if (DATE_Q.test(q) && HAS_DATE.test(text)) bonus = Math.max(bonus, 0.7);
  return bonus;
}

export function rerank(question: string, hits: Hit[]): Hit[] {
  if (!hits.length) return hits;
  const terms = contentTerms(question);
  const best = Math.max(...hits.map((h) => h.score)) || 1;
  return hits
    .map((h) => ({ h, s: 0.45 * (h.score / best) + 0.4 * termCoverage(terms, indexText(h.chunk)) + 0.15 * answerTypeBonus(question, h.chunk.text) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.h);
}

/* ================= offices ================= */
const OFFICES: [RegExp, string][] = [
  [/attend|condon|medical|leave|credit|register|registration|semester drop|break|grade|promot|degree|course|exchange|transfer/, "Academic Office"],
  [/exam|re-?evaluat|admit card|result|make-?up|unfair means|marks/, "Examination Cell"],
  [/fee|refund|payment|pay|scholarship|dues|demand draft|late fee/, "Accounts Office"],
  [/hostel|warden|room|mess|guest|visitor|night-?out|in-?time/, "Hostel Office (Warden)"],
  [/library|book/, "Library"],
];
export function suggestOffice(question: string, hint?: string | null): string {
  const q = question.toLowerCase();
  for (const [p, o] of OFFICES) if (p.test(q)) return o;
  if (hint) for (const [p, o] of OFFICES) if (p.test(hint.toLowerCase())) return o;
  return "Student Welfare Office";
}

/* ================= confidence ================= */
const LEVELS = ["Low", "Medium", "High"] as const;
export type Level = (typeof LEVELS)[number];
export function assessConfidence(o: { coverage: number; verified_quotes: number; conflict: boolean; status: string }): [Level, string] {
  if (o.status !== "Answered" && o.status !== "Conflicting Evidence") return ["Low", "No policy clause answers this question directly."];
  if (o.verified_quotes === 0) return ["Low", "The quoted evidence could not be verified against the retrieved policy text."];
  if (o.conflict) return ["Medium", "Two policy sources give different values; confirm with the office named."];
  if (o.coverage >= 0.75) return ["High", "A verified clause covers all key parts of the question."];
  if (o.coverage >= 0.5) return ["Medium", "A verified clause covers most, but not all, parts of the question."];
  return ["Low", "The verified clause is only partly related to the question."];
}
export const capConfidence = (claim: string | null, evidence: Level): Level =>
  claim && (LEVELS as readonly string[]).includes(claim) ? LEVELS[Math.min(LEVELS.indexOf(claim as Level), LEVELS.indexOf(evidence))] : evidence;

/* ================= output parser ================= */
export const STATUSES = ["Answered", "Needs Clarification", "Not Covered", "Conflicting Evidence"];
const LABELS: Record<string, string> = {
  answer: "answer", "supporting evidence": "evidence", evidence: "evidence", "source clause": "evidence",
  source: "source", sources: "source", section: "source", confidence: "confidence", status: "status",
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LABEL_RE = new RegExp(
  `^\\s*(?:[-*#>]+\\s*)?\\**\\s*(${Object.keys(LABELS).sort((a, b) => b.length - a.length).map(esc).join("|")})\\s*\\**\\s*[:：]\\s*\\**`, "gim");
const REQUIRED = ["answer", "evidence", "source", "confidence", "status"];

export interface Parsed { answer: string; evidence: string[]; sources: string[]; confidence: string | null; status: string | null; status_inferred: boolean; missing_fields: string[]; format_ok: boolean }

const isNone = (s: string) => ["", "none", "n/a", "na", "not applicable", "-"].includes(s.trim().replace(/^[."']+|[."']+$/g, "").toLowerCase());
function splitQuotes(block: string): string[] {
  const quoted = [...block.matchAll(/["“]([^"”]{8,})["”]/g)].map((m) => m[1].trim());
  if (quoted.length) return quoted;
  return block.split("\n").map((l) => l.trim().replace(/^[-*\t ]+|[-*\t ]+$/g, "")).filter((l) => l && !isNone(l));
}
export function inferStatus(answer: string, evidence: string[]): string {
  const a = answer.toLowerCase();
  if (/conflict|contradict|differ(?:ent|s)? (?:value|amount)|two (?:different )?(?:sources|documents)/.test(a)) return "Conflicting Evidence";
  if (/(?:does|do) not (?:cover|mention|specify|contain)|not covered|no information|not (?:mentioned|specified)|cannot find|isn't covered/.test(a)) return "Not Covered";
  if (!evidence.length && a.trimEnd().endsWith("?")) return "Needs Clarification";
  return "Answered";
}
export function parseOutput(text: string): Parsed {
  const fields: Record<string, string[]> = {};
  const matches = [...(text || "").matchAll(LABEL_RE)];
  matches.forEach((m, i) => {
    const key = LABELS[m[1].toLowerCase()];
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const value = text.slice(m.index! + m[0].length, end).trim().replace(/^\*+|\*+$/g, "").trim();
    (fields[key] ??= []).push(value);
  });
  if (!matches.length && text.trim()) fields.answer = [text.trim()];
  const answer = (fields.answer ?? []).join("\n").trim();
  const evidence = (fields.evidence ?? []).flatMap(splitQuotes);
  const sources = (fields.source ?? []).flatMap((b) => b.split("\n").map((l) => l.trim().replace(/^[-*\t ]+|[-*\t ]+$/g, ""))).filter((s) => s && !isNone(s));
  const cm = (fields.confidence ?? []).join(" ").match(/\b(high|medium|low)\b/i);
  const confidence = cm ? cm[1][0].toUpperCase() + cm[1].slice(1).toLowerCase() : null;
  const st = (fields.status ?? []).join(" ").toLowerCase();
  let status = STATUSES.find((s) => st.includes(s.toLowerCase())) ?? null;
  const missing = REQUIRED.filter((k) => !(k in fields) || (k === "status" && !status) || (k === "confidence" && !confidence));
  let inferred = false;
  if (status === null) {
    status = inferStatus(answer, evidence);
    inferred = true;
  }
  return { answer, evidence, sources, confidence, status, status_inferred: inferred, missing_fields: missing, format_ok: !missing.length };
}

/* ================= citation validation ================= */
const SECTION_RE = /(?:section|sec\.?|clause|§)\s*(\d+(?:\.\d+)*)|\b(\d+\.\d+(?:\.\d+)*)\b/gi;

// Ratcliff/Obershelp similarity, as Python's difflib.SequenceMatcher.ratio() (without autojunk).
function matches(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let best = 0, ai = 0, bj = 0;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) { best = cur[j]; ai = i - best; bj = j - best; }
      }
    }
    prev = cur;
  }
  if (!best) return 0;
  return best + matches(a.slice(0, ai), b.slice(0, bj)) + matches(a.slice(ai + best), b.slice(bj + best));
}
const ratio = (a: string, b: string) => (a.length + b.length ? (2 * matches(a, b)) / (a.length + b.length) : 1);

function bestSimilarity(quote: string, text: string): number {
  const q = quoteNorm(quote), t = quoteNorm(text);
  if (!q) return 0;
  if (t.includes(q)) return 1;
  if (q.length > t.length) return ratio(q, t);
  let best = 0;
  const step = Math.max(1, Math.floor(q.length / 4));
  for (let i = 0; i <= t.length - q.length; i += step) {
    best = Math.max(best, ratio(q, t.slice(i, i + q.length)));
    if (best > 0.97) break;
  }
  return best;
}

export interface VerifiedQuote {
  quote: string; chunk_id: string | null; document: string | null; document_id: number | null; section: string | null;
  heading: string | null; page: number | null; category: string | null; similarity: number; verified: boolean; section_cited: boolean;
}
export interface CitationReport { quotes: VerifiedQuote[]; cited_sections: string[]; unsupported_numbers: string[] }

export function validateCitations(evidence: string[], sources: string[], answer: string, hits: Hit[], threshold = 0.9): CitationReport {
  const cited_sections: string[] = [];
  for (const s of sources) for (const m of s.matchAll(SECTION_RE)) cited_sections.push(m[1] || m[2]);
  const cited = new Set(cited_sections);
  const quotes: VerifiedQuote[] = evidence.map((quote) => {
    let bestHit: Hit | null = null, bestSim = 0;
    for (const h of hits) {
      const sim = bestSimilarity(quote, h.chunk.text);
      if (sim > bestSim + 1e-9 || (Math.abs(sim - bestSim) < 1e-9 && cited.has(h.chunk.section))) { bestHit = h; bestSim = sim; }
    }
    const c = bestHit?.chunk ?? null;
    return {
      quote, chunk_id: c?.id ?? null, document: c?.title ?? null, document_id: c?.document_id ?? null, section: c?.section ?? null,
      heading: c?.heading ?? null, page: c?.page ?? null, category: c?.category ?? null, similarity: Math.round(bestSim * 1000) / 1000,
      verified: !!c && bestSim >= threshold, section_cited: !!c && cited.has(c.section),
    };
  });
  const evNums = new Set<string>();
  for (const h of hits) for (const n of [...numbersIn(h.chunk.text), ...numbersIn(h.chunk.title)]) evNums.add(n);
  const ansWo = answer.replace(/\[E\d+\]/g, " ").replace(SECTION_RE, " ");
  const unsupported = [...numbersIn(ansWo)].sort().filter((n) => !evNums.has(n));
  return { quotes, cited_sections, unsupported_numbers: unsupported };
}

/* ================= demo answerer ================= */
function sentences(text: string): string[] {
  return text.split(/(?<!Rs)(?<!\b[a-z])\.\s+(?=[A-Z])/).map((p) => {
    p = p.trim();
    return p && !p.endsWith(".") ? p + "." : p;
  }).filter((p) => p.length > 3);
}
function bestSentence(question: string, text: string): string {
  if (text.length <= 350) return text.trim();
  const terms = contentTerms(question);
  const sents = sentences(text);
  if (!sents.length) return text;
  return sents.reduce((best, s) => {
    const a = termCoverage(terms, s), b = termCoverage(terms, best);
    return a > b || (a === b && s.length > best.length) ? s : best;
  });
}
const fmt = (answer: string, quotes: string[], sources: string[], status: string) =>
  `Answer:\n${answer}\n\nSupporting Evidence:\n${quotes.map((q) => `"${q}"`).join("\n") || "None"}\n\nSource:\n${sources.join("\n") || "None"}\n\nConfidence:\nLow\n\nStatus:\n${status}`;

export function demoGenerate(question: string, hits: Hit[]): string {
  if (!hits.length) return fmt(`The provided policy documents do not cover this. Please contact the ${suggestOffice(question)}.`, [], [], "Not Covered");
  const conflicts = detectConflicts(question, hits);
  if (conflicts.length) {
    const [a, b] = conflicts[0];
    const qa = sentences(a.chunk.text).find((s) => moneyIn(s).size) ?? a.chunk.text;
    const qb = sentences(b.chunk.text).find((s) => moneyIn(s).size) ?? b.chunk.text;
    const office = suggestOffice(question, a.chunk.category);
    const answer = `The policy documents disagree: ${a.chunk.title}, Section ${a.chunk.section} and ${b.chunk.title}, Section ${b.chunk.section} state different amounts. Please confirm the applicable rule with the ${office}.`;
    return fmt(answer, [qa, qb], [`${a.chunk.title}, Section ${a.chunk.section}`, `${b.chunk.title}, Section ${b.chunk.section}`], "Conflicting Evidence");
  }
  const top = hits[0].chunk;
  const quote = bestSentence(question, top.text);
  return fmt(`As per ${top.title}, Section ${top.section}: ${quote}`, [quote], [`${top.title}, Section ${top.section}`], "Answered");
}

/* ================= extraction + chunking ================= */
const HEADING_RE = /^(?:section|chapter|part)?\s*(\d{1,2})[.:)]?\s+([A-Z][A-Za-z ,&'()/-]{2,80})$/i;
const CLAUSE_RE = /^(?:section|clause|rule|para(?:graph)?)?\s*(\d{1,2}(?:\.\d{1,2}){1,3})[.:)]?\s+(.+)$/i;
export interface Chunk { seq: number; section: string; heading: string; page: number; text: string }

export function stripBoilerplate(pages: string[]): string[] {
  const counts = new Map<string, number>();
  for (const p of pages) for (const l of p.split("\n")) { const s = l.trim(); if (s) counts.set(s, (counts.get(s) ?? 0) + 1); }
  const boiler = new Set([...counts].filter(([l, n]) => n >= 2 && l.length > 30).map(([l]) => l));
  return pages.map((p) => p.split("\n").filter((l) => !boiler.has(l.trim())).join("\n"));
}

function splitLong(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  let cur = "";
  for (const s of text.split(/(?<=[.;])\s+/)) {
    if (cur && cur.length + s.length + 1 > limit) { parts.push(cur.trim()); cur = ""; }
    cur += " " + s;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export function chunkDocument(pages: string[], maxChars = 900): Chunk[] {
  const clause: Chunk[] = [];
  let heading = "", curSec: string | null = null, curText: string[] = [], curPage = 1;
  const flush = () => {
    if (curSec && curText.length) {
      const body = curText.join(" ").replace(/\s+/g, " ").trim();
      for (const part of splitLong(body, maxChars)) clause.push({ seq: clause.length, section: curSec, heading, page: curPage, text: part });
    }
    curSec = null; curText = [];
  };
  pages.forEach((page, pi) => {
    for (const raw of page.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const mc = CLAUSE_RE.exec(line);
      const mh = mc ? null : HEADING_RE.exec(line);
      if (mc) { flush(); curSec = mc[1]; curText = [mc[2]]; curPage = pi + 1; }
      else if (mh && line.length < 90) { flush(); heading = mh[2].trim(); }
      else if (curSec) curText.push(line);
    }
  });
  flush();
  const total = pages.reduce((s, p) => s + p.length, 0);
  if (clause.length && clause.reduce((s, c) => s + c.text.length, 0) >= 0.4 * total) return clause;
  const win: Chunk[] = [];
  pages.forEach((page, pi) => {
    let buf = "";
    for (const para of page.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean)) {
      if (buf && buf.length + para.length > maxChars) { win.push({ seq: win.length, section: `p.${pi + 1}`, heading: "", page: pi + 1, text: buf.trim() }); buf = buf.slice(-150); }
      buf += " " + para;
    }
    if (buf.trim()) win.push({ seq: win.length, section: `p.${pi + 1}`, heading: "", page: pi + 1, text: buf.trim() });
  });
  return win;
}

/* ================= prompt files ================= */
export interface PromptVersion {
  id: string; name: string; system_prompt: string | null; user_template: string; temperature: number | null;
  source: string; notes: string; builtin: boolean; created_at: string | null; base_version: string | null;
}
function blockAfter(heading: string, text: string): string {
  const m = new RegExp(`^##\\s+${esc(heading)}\\s*\\n+\`\`\`[a-z]*\\n([\\s\\S]*?)\\n\`\`\``, "m").exec(text);
  if (!m) throw new Error(`Section '## ${heading}' not found`);
  return m[1];
}
export function parsePromptFile(id: string, text: string, source: string): PromptVersion {
  const meta: Record<string, string> = {};
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (fm) for (const line of fm[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  const system = blockAfter("System Prompt", text).trim();
  const t = meta.temperature ?? "default";
  const why = /^## What changed.*?\n([\s\S]*?)(?=^## System Prompt)/m.exec(text);
  return {
    id, name: meta.name ?? id, system_prompt: system.toLowerCase() === "none" ? null : system,
    user_template: blockAfter("User Prompt Template", text).trim(), temperature: ["", "default", "none"].includes(t) ? null : Number(t),
    source, notes: why ? why[1].trim() : "", builtin: true, created_at: null, base_version: null,
  };
}
export function formatExcerpts(hits: Hit[]): string {
  return hits.map((h, i) => `[E${i + 1}] ${h.chunk.title} - Section ${h.chunk.section}${h.chunk.heading ? ` (${h.chunk.heading})` : ""}\n${h.chunk.text}`).join("\n\n") || "(no excerpts were retrieved)";
}
export function renderPrompt(v: PromptVersion, question: string, hits: Hit[]): [string | null, string] {
  const ex = formatExcerpts(hits);
  const user = v.user_template.split("{policy_excerpts}").join(ex).split("{policy_text}").join(ex).split("{question}").join(question.trim());
  return [v.system_prompt, user];
}
