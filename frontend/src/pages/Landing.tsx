import { motion } from "framer-motion";
import {
  ArrowRight, BadgeCheck, BookOpenCheck, Building2, CalendarClock, FileSearch, GraduationCap, Home, Landmark, Languages,
  Lock, MessageSquareText, Quote, ScrollText, ShieldCheck, Sparkles, Wallet,
} from "lucide-react";
import { Link } from "../router";
import { Logo } from "../components/ui";

const FEATURES = [
  { icon: Quote, title: "Exact clause quotations", text: "Every answer quotes the policy sentence it relies on, and the quote is checked word for word against the document." },
  { icon: FileSearch, title: "Document and section cited", text: "See the document name and section number, so you can open the PDF and read the rule yourself." },
  { icon: ShieldCheck, title: "Refuses to guess", text: "If the policies don't cover your question, CampusSage says so and points you to the right office." },
  { icon: MessageSquareText, title: "Asks when unclear", text: "\"What is the deadline?\" gets one clarifying question instead of a confident wrong answer." },
  { icon: Languages, title: "Understands Hinglish", text: "Ask the way you'd ask a senior. Answers come back in plain, student-friendly English." },
  { icon: BadgeCheck, title: "Flags conflicting rules", text: "When a notice and a regulation disagree, you see both clauses instead of one being picked silently." },
];

const STEPS = [
  { n: "01", title: "Ask in your own words", text: "Type a question about attendance, exams, fees, hostel or academics." },
  { n: "02", title: "Policies are searched", text: "Semantic search finds the most relevant clauses across all uploaded PDFs." },
  { n: "03", title: "Evidence is checked", text: "If no clause really answers the question, CampusSage stops and says so." },
  { n: "04", title: "A cited answer", text: "A short answer, the exact quotation, the section, and an evidence-based confidence." },
];

const CATEGORIES = [
  { icon: CalendarClock, name: "Attendance Policy", q: "What is the minimum attendance required to appear in end-semester examinations?" },
  { icon: ScrollText, name: "Examination Policy", q: "How do I apply for re-evaluation?" },
  { icon: Wallet, name: "Fee Regulations", q: "What is the last date to pay the odd-semester fee without a late fee?" },
  { icon: Home, name: "Hostel Policy", q: "What time do I need to be back in the hostel at night?" },
  { icon: GraduationCap, name: "Academic Regulations", q: "How many credits do I need to be promoted to the next year?" },
  { icon: Landmark, name: "General Notices", q: "What are the library hours during examinations?" },
];

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-blue-100/70 via-white to-transparent blur-2xl" />
      {/* stacked policy pages */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute left-6 top-4 h-56 w-44 rounded-xl border border-line bg-white p-4 shadow-sm"
          style={{ rotate: -8 + i * 6, zIndex: i }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * i, duration: 0.5 }}
        >
          <div className="mb-3 h-2 w-20 rounded bg-navy-900/80" />
          {Array.from({ length: 7 }).map((_, j) => (
            <div key={j} className="mb-2 h-1.5 rounded bg-slate-200" style={{ width: `${60 + ((j * 37 + i * 11) % 40)}%` }} />
          ))}
          {i === 2 && <motion.div className="absolute left-3 right-3 top-[104px] h-5 rounded bg-blue-200/70" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1] }} transition={{ delay: 0.9, duration: 1.2 }} />}
        </motion.div>
      ))}
      {/* answer card */}
      <motion.div
        className="relative z-10 ml-auto mt-24 w-72 rounded-2xl border border-line bg-white p-4 shadow-xl shadow-navy-900/10"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-200">Answered</span>
          <span className="flex gap-0.5">{[1, 2, 3].map((k) => <span key={k} className="h-3 w-1.5 rounded-sm bg-emerald-500" />)}</span>
          <span className="text-slate-500">High</span>
        </div>
        <p className="text-sm text-ink">You need at least the minimum attendance stated in the policy to sit the end-semester exam.</p>
        <motion.div className="mt-3 rounded-r-lg border-l-[3px] border-accent bg-accent-soft/70 px-3 py-2 font-serif text-[13px] text-navy-900" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
          “A student must maintain a minimum of … attendance in each course …”
        </motion.div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <BadgeCheck size={12} className="text-emerald-600" /> Attendance Policy · <span className="font-semibold text-accent">§ 2.1</span>
        </div>
      </motion.div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/"><Logo /></Link>
          <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
            <a href="#features" className="hover:text-navy-900">Features</a>
            <a href="#how" className="hover:text-navy-900">How it works</a>
            <a href="#categories" className="hover:text-navy-900">Policies</a>
            <a href="#trust" className="hover:text-navy-900">Privacy</a>
            <Link to="/about" className="hover:text-navy-900">Team</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="btn-ghost btn-sm hidden sm:inline-flex">Dashboard</Link>
            <Link to="/chat" className="btn-primary btn-sm">Ask CampusSage</Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#e8f0fe_0%,transparent_55%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:py-24">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-slate-600">
              <Sparkles size={13} className="text-accent" /> Retrieval-augmented · Source-grounded · Cited
            </span>
            <h1 className="mt-5 font-serif text-[2.6rem] leading-[1.08] tracking-tight text-navy-900 sm:text-6xl">
              Your University.<br />Your Questions.<br /><span className="text-accent">Clear Answers.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              CampusSage answers questions about attendance, examinations, fees, hostel and academic rules using only the
              official policy documents, quoting the exact clause and section every time. If the policy is silent, it tells you so.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/chat" className="btn-primary px-5 py-3 text-[15px]">Ask CampusSage <ArrowRight size={16} /></Link>
              <a href="#features" className="btn-ghost px-5 py-3 text-[15px]">Explore Features</a>
            </div>
          </motion.div>
          <div className="h-[340px]"><HeroVisual /></div>
        </div>
      </section>

      {/* features */}
      <section id="features" className="border-t border-line bg-mist py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Features</p>
          <h2 className="mt-2 max-w-2xl font-serif text-4xl text-navy-900">Built to be trusted, not just to sound right</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <motion.div key={title} className="card p-6" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Icon size={20} /></div>
                <h3 className="mt-4 font-semibold text-navy-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">How it works</p>
          <h2 className="mt-2 font-serif text-4xl text-navy-900">From question to cited answer</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="relative">
                <div className="font-serif text-4xl text-blue-200">{s.n}</div>
                <h3 className="mt-2 font-semibold text-navy-900">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* categories */}
      <section id="categories" className="border-t border-line bg-mist py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Supported policy categories</p>
          <h2 className="mt-2 font-serif text-4xl text-navy-900">Ask about any of these</h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map(({ icon: Icon, name, q }) => (
              <Link key={name} to={`/chat?q=${encodeURIComponent(q)}`} className="card group flex items-start gap-4 p-5 transition-shadow hover:shadow-md">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-900 text-white"><Icon size={18} /></div>
                <div>
                  <div className="font-semibold text-navy-900">{name}</div>
                  <div className="mt-1 text-sm text-slate-500 group-hover:text-slate-700">“{q}”</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* trust */}
      <section id="trust" className="py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Trust & privacy</p>
            <h2 className="mt-2 font-serif text-4xl text-navy-900">Policy text in, nothing personal out</h2>
            <p className="mt-4 text-slate-600">CampusSage is a reading assistant for published rules. It is not an official decision-maker. For anything that affects your record, confirm with the office it names.</p>
          </div>
          <ul className="space-y-4">
            {[
              { icon: Lock, t: "No student records", d: "It only reads policy PDFs. It cannot see attendance, marks, fees or any personal data, and refuses requests for them." },
              { icon: BookOpenCheck, t: "Verifiable answers", d: "Quotations are checked against the source text before you see them. Unverifiable answers are withheld." },
              { icon: Building2, t: "Points to a human", d: "When a policy is silent or two documents conflict, you are sent to the office that can decide." },
              { icon: ShieldCheck, t: "Keys stay on the server", d: "AI provider keys live only in the backend environment, never in the browser or the repository." },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex gap-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={18} /></div>
                <div><div className="font-semibold text-navy-900">{t}</div><div className="text-sm text-slate-600">{d}</div></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-3xl bg-navy-900 px-8 py-10 md:flex-row md:items-center">
          <div>
            <h2 className="font-serif text-3xl text-white">Have a question about a rule?</h2>
            <p className="mt-1 text-slate-300">Get a cited answer in seconds.</p>
          </div>
          <Link to="/chat" className="btn bg-white text-navy-900 hover:bg-blue-50">Ask CampusSage <ArrowRight size={16} /></Link>
        </div>
      </section>

      <footer className="border-t border-line bg-mist">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-slate-600 sm:px-6 md:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-3">AI-Powered University Policy &amp; Student Helpdesk.</p>
          </div>
          <div>
            <div className="font-semibold text-navy-900">Project</div>
            <p className="mt-2">SCSE4041 Prompt Engineering · Bennett University</p>
            <p>Team Agentic Minds (PE-B01-18) · Problem Pool C1</p>
          </div>
          <div>
            <div className="font-semibold text-navy-900">Note</div>
            <p className="mt-2">Bundled documents are clearly labelled samples for demonstration, not official university policy.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
