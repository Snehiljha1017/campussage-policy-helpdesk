import { BookOpen, Cpu, Database, FileSearch, Layers, Rocket, Target, Users } from "lucide-react";
import AppLayout from "../components/AppLayout";
import { PageHeader, Pill } from "../components/ui";

const INFO = [
  ["Project", "CampusSage — AI-Powered University Policy & Student Helpdesk"],
  ["Course", "SCSE4041 Prompt Engineering, Bennett University"],
  ["Team", "Agentic Minds"],
  ["Team ID", "PE-B01-18"],
  ["Batch group", "B01 – B12"],
  ["Problem source", "Problem Pool · C1"],
];

const MEMBERS = [
  { name: "Snehil Jha", role: "Team leader" },
  { name: "Tanya Sinha", role: "Team member" },
];

const STACK = [
  { icon: Layers, title: "Frontend", items: ["React + TypeScript", "Tailwind CSS", "Framer Motion", "Recharts", "Lucide icons"] },
  { icon: Cpu, title: "Backend & AI", items: ["Python FastAPI (REST)", "LangChain chat models", "OpenAI API (configurable model)", "Prompt versions V1–V3"] },
  { icon: FileSearch, title: "Retrieval (RAG)", items: ["PyMuPDF extraction", "Clause-aware chunking", "ChromaDB + sentence-transformers", "TF-IDF fallback index"] },
  { icon: Database, title: "Data & evaluation", items: ["SQLite (documents, history, feedback, runs)", "14-case test suite + 8 holdout", "Automated metrics, CSV export"] },
];

const FUTURE = [
  "Replace the labelled sample PDFs with Bennett's public handbook and regulations, re-run the full evaluation.",
  "Multilingual embeddings or an LLM query-rewriting step for Hinglish phrasings outside the built-in vocabulary.",
  "OCR for scanned notices, and table-aware extraction for fee schedules.",
  "Document versioning so a newer notice can be shown as superseding an older clause.",
  "Admin review queue for questions marked 'not helpful' or 'not covered'.",
];

export default function About() {
  return (
    <AppLayout>
      <PageHeader title="About CampusSage" subtitle="A prompt-engineering mini project built to give students reliable, cited answers about university rules." />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold text-navy-900"><BookOpen size={18} className="text-accent" /> Project</h2>
          <dl className="mt-4 divide-y divide-line text-sm">
            {INFO.map(([k, v]) => <div key={k} className="grid grid-cols-[130px_1fr] gap-3 py-2.5"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-navy-900">{v}</dd></div>)}
          </dl>
        </section>
        <section className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold text-navy-900"><Users size={18} className="text-accent" /> Team Agentic Minds</h2>
          <ul className="mt-4 space-y-3">
            {MEMBERS.map((m) => (
              <li key={m.name} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-navy-900 text-sm font-semibold text-white">{m.name.split(" ").map((p) => p[0]).join("")}</div>
                <div><div className="font-medium text-navy-900">{m.name}</div><div className="text-xs text-slate-500">{m.role}</div></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold text-navy-900"><Target size={18} className="text-accent" /> The problem</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">Rules on attendance, examinations, fees and hostel life are spread across long PDFs, handbooks and notices. Students, especially first-years, ask seniors or staff and get inconsistent answers, which leads to missed deadlines and avoidable penalties. Staff answer the same questions again and again.</p>
        </section>
        <section className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold text-navy-900"><Rocket size={18} className="text-accent" /> Our solution</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">A retrieval-augmented helpdesk. It finds the relevant clauses and checks they actually answer the question. An engineered prompt then writes a short answer with the exact quotation and section, and every quotation is verified against the source before it is shown. Where the policy is silent, unclear or contradictory, CampusSage says so instead of guessing.</p>
        </section>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Technology stack</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STACK.map(({ icon: Icon, title, items }) => (
          <section key={title} className="card p-5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={18} /></div>
            <h3 className="mt-3 font-semibold text-navy-900">{title}</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">{items.map((i) => <li key={i}>{i}</li>)}</ul>
          </section>
        ))}
      </div>

      <section className="card mt-6 p-6">
        <h2 className="font-semibold text-navy-900">Future scope</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">{FUTURE.map((f) => <li key={f}>{f}</li>)}</ul>
      </section>
      <p className="mt-6 text-xs text-slate-500"><Pill tone="amber">Note</Pill> The bundled documents are labelled samples written for demonstration. They are not official Bennett University policy.</p>
    </AppLayout>
  );
}
