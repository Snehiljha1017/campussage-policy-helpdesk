// In-browser retrieval index: a faithful port of the backend's TF-IDF index
// (scikit-learn TfidfVectorizer: word 1-2 grams with English stop words +
// char_wb 3-5 grams, sublinear tf, smoothed idf, L2 norm; score = 0.65*word + 0.35*char).
import data from "../data.generated.json";
import { expandQuery } from "./text";

export interface IndexedChunk {
  id: string;
  document_id: number;
  title: string;
  category: string;
  section: string;
  heading: string;
  page: number;
  text: string;
}
export interface Hit { chunk: IndexedChunk; score: number }

export const indexText = (c: IndexedChunk) => `${c.title}. ${c.heading}. Section ${c.section}. ${c.text}`;

const SK_STOP = new Set<string>(data.sklearn_stop_words);

function wordGrams(doc: string): string[] {
  const toks = (doc.toLowerCase().match(/\b\w\w+\b/g) ?? []).filter((t) => !SK_STOP.has(t));
  const out = [...toks];
  for (let i = 0; i + 1 < toks.length; i++) out.push(`${toks[i]} ${toks[i + 1]}`);
  return out;
}

function charWbGrams(doc: string): string[] {
  const out: string[] = [];
  for (const w0 of doc.toLowerCase().replace(/\s\s+/g, " ").split(/\s+/).filter(Boolean)) {
    const w = ` ${w0} `;
    for (let n = 3; n <= 5; n++) {
      let off = 0;
      out.push(w.slice(off, off + n));
      while (off + n < w.length) {
        off++;
        out.push(w.slice(off, off + n));
      }
      if (off === 0) break;
    }
  }
  return out;
}

type Vec = Map<number, number>;

class Vectorizer {
  vocab = new Map<string, number>();
  idf: number[] = [];
  constructor(private analyzer: (d: string) => string[]) {}

  fit(docs: string[]): Vec[] {
    const df = new Map<string, number>();
    const grams = docs.map((d) => this.analyzer(d));
    for (const g of grams) for (const t of new Set(g)) df.set(t, (df.get(t) ?? 0) + 1);
    this.vocab = new Map([...df.keys()].sort().map((t, i) => [t, i]));
    const n = docs.length;
    this.idf = [...this.vocab.keys()].map((t) => Math.log((1 + n) / (1 + (df.get(t) ?? 0))) + 1);
    return grams.map((g) => this.vec(g));
  }

  transform(doc: string): Vec {
    return this.vec(this.analyzer(doc));
  }

  private vec(grams: string[]): Vec {
    const tf = new Map<number, number>();
    for (const g of grams) {
      const i = this.vocab.get(g);
      if (i !== undefined) tf.set(i, (tf.get(i) ?? 0) + 1);
    }
    const v: Vec = new Map();
    let norm = 0;
    for (const [i, c] of tf) {
      const w = (1 + Math.log(c)) * this.idf[i];
      v.set(i, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [i, w] of v) v.set(i, w / norm);
    return v;
  }
}

const dot = (a: Vec, b: Vec) => {
  let s = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const [i, w] of small) {
    const o = big.get(i);
    if (o !== undefined) s += w * o;
  }
  return s;
};

class Index {
  chunks: IndexedChunk[] = [];
  private word = new Vectorizer(wordGrams);
  private char = new Vectorizer(charWbGrams);
  private Xw: Vec[] = [];
  private Xc: Vec[] = [];

  load(chunks: IndexedChunk[]) {
    this.chunks = chunks;
    if (!chunks.length) {
      this.Xw = this.Xc = [];
      return;
    }
    const texts = chunks.map((c) => expandQuery(indexText(c)));
    this.Xw = this.word.fit(texts);
    this.Xc = this.char.fit(texts);
  }

  search(query: string, k = 5): Hit[] {
    if (!this.chunks.length) return [];
    const q = expandQuery(query);
    const qw = this.word.transform(q);
    const qc = this.char.transform(q);
    const scored = this.chunks.map((chunk, i) => ({ chunk, score: 0.65 * dot(this.Xw[i], qw) + 0.35 * dot(this.Xc[i], qc) }));
    return scored.sort((a, b) => b.score - a.score).slice(0, k);
  }
}

export const index = new Index();
export const RETRIEVAL_DESCRIPTION = "TF-IDF keyword index (word + character n-grams), running in your browser";
