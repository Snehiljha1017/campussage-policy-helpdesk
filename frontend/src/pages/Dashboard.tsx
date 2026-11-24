import { FormEvent, useState } from "react";
import {
  ArrowRight, BookOpen, CalendarClock, ChevronDown, FileText, GraduationCap, Home, Landmark, MessageSquareText,
  ScrollText, Search, ThumbsUp, Wallet,
} from "lucide-react";
import AppLayout, { DemoModeBanner } from "../components/AppLayout";
import { cx, EmptyState, ErrorBanner, fmtDate, Pill, Skeleton, StatCard, StatusBadge, useApi } from "../components/ui";
import { Link, navigate } from "../router";
import { api } from "../services/api";

const CATEGORY_CARDS = [
  { name: "Attendance Policy", icon: CalendarClock, q: "What is the minimum attendance required to appear in end-semester examinations?" },
  { name: "Examination Policy", icon: ScrollText, q: "Can I sit for the end-semester exam if my fee dues are pending?" },
  { name: "Fee Regulations", icon: Wallet, q: "What is the last date to pay the odd-semester fee without a late fee?" },
  { name: "Hostel Policy", icon: Home, q: "What time do I need to be back in the hostel at night?" },
  { name: "Academic Regulations", icon: GraduationCap, q: "How many credits do I need to earn to be promoted to the next academic year?" },
  { name: "General Notices", icon: Landmark, q: "What are the library hours during examination weeks?" },
];

const FAQ = [
  "What happens if my attendance is below the requirement?",
  "Can attendance shortfall be condoned on medical grounds?",
  "How do I apply for re-evaluation of my answer script?",
  "Can I get a refund if I withdraw from the programme?",
  "Are visitors allowed inside hostel rooms?",
  "How many semesters can I take as a break during my degree?",
];

function FaqItem({ q }: { q: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-line last:border-0">
      <button className="flex w-full items-center gap-3 py-3 text-left text-sm font-medium text-navy-900" onClick={() => setOpen(!open)} aria-expanded={open}>
        {q}
        <ChevronDown size={16} className={cx("ml-auto shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="pb-3 text-sm text-slate-600">
          CampusSage answers this from the indexed policies with a cited clause.{" "}
          <Link to={`/chat?q=${encodeURIComponent(q)}`} className="font-medium text-accent hover:underline">Ask it now →</Link>
        </div>
      )}
    </li>
  );
}

export default function Dashboard() {
  const [q, setQ] = useState("");
  const stats = useApi(() => api.stats(), []);
  const history = useApi(() => api.history(6), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/chat?q=${encodeURIComponent(q.trim())}`);
  };
  const chunks = stats.data?.categories.reduce((s, c) => s + (c.chunks || 0), 0) ?? 0;
  const counts = Object.fromEntries((stats.data?.categories ?? []).map((c) => [c.category, c.documents]));

  return (
    <AppLayout>
      <DemoModeBanner />
      <section className="card relative overflow-hidden bg-navy-900 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <p className="text-sm text-blue-200">Welcome back</p>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl">What would you like to know today?</h1>
        <form onSubmit={submit} className="relative mt-6 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input py-3 pl-10 text-[15px]" placeholder="e.g. Can I appear for exams with 70% attendance?" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ask a question" />
          </div>
          <button className="btn bg-white text-navy-900 hover:bg-blue-50" type="submit" disabled={!q.trim()}>Ask <ArrowRight size={16} /></button>
        </form>
      </section>

      {stats.error && <div className="mt-6"><ErrorBanner message={stats.error} onRetry={() => stats.reload()} /></div>}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
          <>
            <StatCard label="Policy documents" value={stats.data?.documents ?? 0} icon={<FileText size={16} />} />
            <StatCard label="Indexed clauses" value={chunks} icon={<BookOpen size={16} />} />
            <StatCard label="Questions asked" value={stats.data?.queries ?? 0} icon={<MessageSquareText size={16} />} />
            <StatCard label="Helpful ratings" value={`${stats.data?.feedback.helpful ?? 0} / ${(stats.data?.feedback.helpful ?? 0) + (stats.data?.feedback.not_helpful ?? 0)}`} icon={<ThumbsUp size={16} />} />
          </>
        )}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Browse by category</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_CARDS.map(({ name, icon: Icon, q: sample }) => (
          <Link key={name} to={`/chat?q=${encodeURIComponent(sample)}`} className="card group p-4 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={18} /></div>
              <div className="font-medium text-navy-900">{name}</div>
              <Pill>{counts[name] ?? 0} {(counts[name] ?? 0) === 1 ? "doc" : "docs"}</Pill>
            </div>
            <p className="mt-3 text-sm text-slate-500 group-hover:text-slate-700">“{sample}”</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-navy-900">Recent questions</h2>
            <Link to="/chat" className="text-xs font-medium text-accent">Open chat →</Link>
          </div>
          {history.loading ? <Skeleton className="h-32" /> : history.error ? <ErrorBanner message={history.error} /> : history.data?.length ? (
            <ul className="divide-y divide-line">
              {history.data.map((h) => (
                <li key={h.id}>
                  <Link to={`/chat?id=${h.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-accent">
                    <span className="line-clamp-1 flex-1 text-navy-900">{h.question}</span>
                    <StatusBadge status={h.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={<MessageSquareText size={20} />} title="No questions yet">Ask your first question above.</EmptyState>}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-navy-900">Recently uploaded documents</h2>
            <Link to="/library" className="text-xs font-medium text-accent">Policy library →</Link>
          </div>
          {stats.loading ? <Skeleton className="h-32" /> : stats.data?.recent_documents.length ? (
            <ul className="divide-y divide-line">
              {stats.data.recent_documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <FileText size={16} className="shrink-0 text-slate-400" />
                  <span className="line-clamp-1 flex-1 text-navy-900">{d.title}</span>
                  {d.is_sample ? <Pill tone="amber">Sample</Pill> : null}
                  <span className="hidden text-xs text-slate-400 sm:inline">{fmtDate(d.uploaded_at)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={<FileText size={20} />} title="No documents" action={<Link to="/library" className="btn-primary btn-sm">Upload a policy</Link>} />}
        </section>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="mb-1 font-semibold text-navy-900">Frequently asked questions</h2>
        <ul>{FAQ.map((f) => <FaqItem key={f} q={f} />)}</ul>
      </section>
    </AppLayout>
  );
}
