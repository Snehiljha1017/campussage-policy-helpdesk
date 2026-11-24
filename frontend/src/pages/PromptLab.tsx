import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeCheck, Beaker, FileCode2, FlaskConical, History, Loader2, Play, Save, Trash2, XCircle } from "lucide-react";
import AppLayout from "../components/AppLayout";
import { cx, EmptyState, ErrorBanner, fmtDate, PageHeader, pct, Pill, Spinner, StatusBadge, useApi } from "../components/ui";
import { Link } from "../router";
import { api } from "../services/api";
import type { ChatResponse, CompareMetrics, CompareResponse, EvalRun, PromptPreview, PromptVersion } from "../services/types";

type Tab = "compare" | "editor" | "versions" | "history";
const METRIC_LABELS: [keyof NonNullable<EvalRun["summary"]>["configs"][string]["metrics"], string][] = [
  ["status_accuracy", "Status accuracy"],
  ["factual_correctness", "Factual correctness"],
  ["citation_accuracy", "Citation accuracy"],
  ["policy_grounding", "Policy grounding"],
  ["format_compliance", "Format compliance"],
  ["hallucination_rate", "Hallucination rate"],
  ["consistency", "Consistency"],
];
const COLORS = ["#94a3b8", "#60a5fa", "#1d4ed8", "#0b1f3a", "#f59e0b", "#10b981"];

function isPreview(r: CompareResponse["results"][number]): r is PromptPreview {
  return "user_prompt" in r;
}

function PromptBlock({ label, text }: { label: string; text: string | null }) {
  return (
    <div>
      <div className="label">{label}</div>
      <pre className="scroll-thin max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-navy-950 p-3 font-mono text-[11.5px] leading-relaxed text-slate-200">{text ?? "none"}</pre>
    </div>
  );
}

function OutputColumn({ vid, name, result, metrics, error }: { vid: string; name: string; result?: ChatResponse; metrics?: CompareMetrics; error?: string }) {
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="border-b border-line bg-mist px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">{vid}</div>
        <div className="text-sm font-medium text-navy-900">{name}</div>
      </div>
      {error && <div className="p-4"><ErrorBanner message={error} /></div>}
      {result && metrics && (
        <div className="flex flex-1 flex-col gap-3 p-4 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={metrics.status} />
            {metrics.status_inferred && <Pill tone="amber">status inferred</Pill>}
            <Pill tone={metrics.format_ok ? "green" : "rose"}>{metrics.format_ok ? "format OK" : `missing: ${metrics.missing_fields.join(", ")}`}</Pill>
            <Pill tone={metrics.quotes_verified > 0 ? "green" : "slate"}><BadgeCheck size={12} /> {metrics.quotes_verified}/{metrics.quotes_total} quotes verified</Pill>
            {metrics.unsupported_numbers.length > 0 && <Pill tone="rose">unsupported: {metrics.unsupported_numbers.join(", ")}</Pill>}
          </div>
          <div>
            <div className="label">Raw model output</div>
            <pre className="scroll-thin max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-white p-3 font-mono text-[11.5px] text-slate-700">{result.raw_output}</pre>
          </div>
          <div className="mt-auto text-xs text-slate-400">{result.model} · {(result.latency_ms / 1000).toFixed(1)} s</div>
        </div>
      )}
    </div>
  );
}

function CompareTab({ versions }: { versions: PromptVersion[] }) {
  const [question, setQuestion] = useState("What is the minimum attendance required to appear in end-semester examinations?");
  const [selected, setSelected] = useState<string[]>(["v1", "v2", "v3"]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const names = Object.fromEntries(versions.map((v) => [v.id, v.name]));
  const run = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { setRes(await api.compare(question, selected)); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  };
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="space-y-5">
      <form onSubmit={run} className="card p-5">
        <label className="label" htmlFor="lab-q">Test question (same input for every version)</label>
        <textarea id="lab-q" className="input min-h-[70px]" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {versions.filter((v) => v.id !== "final").map((v) => (
            <label key={v.id} className={cx("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium", selected.includes(v.id) ? "border-accent bg-accent-soft text-accent" : "border-line text-slate-600")}>
              <input type="checkbox" className="accent-blue-600" checked={selected.includes(v.id)} onChange={() => toggle(v.id)} /> {v.id}
            </label>
          ))}
          <button className="btn-primary ml-auto" disabled={busy || !question.trim() || selected.length === 0}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run comparison
          </button>
        </div>
      </form>
      {error && <ErrorBanner message={error} />}
      {busy && <Spinner label={`Running ${selected.length} prompt version(s)…`} />}
      {res && !res.llm_available && (
        <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{res.message}</div>
          <div className="grid gap-4 lg:grid-cols-3">
            {res.results.filter(isPreview).map((p) => (
              <div key={p.version_id} className="card space-y-3 p-4">
                <div className="flex items-center gap-2"><Pill tone="navy">{p.version_id}</Pill><span className="text-xs text-slate-500">temperature {p.temperature ?? "default"}</span></div>
                <PromptBlock label="System prompt sent" text={p.system_prompt} />
                <PromptBlock label="User prompt sent" text={p.user_prompt} />
              </div>
            ))}
          </div>
        </>
      )}
      {res?.llm_available && (
        <div className={cx("grid gap-4", res.results.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
          {res.results.map((r) => !isPreview(r) && <OutputColumn key={r.version_id} vid={r.version_id} name={names[r.version_id] ?? r.version_id} result={r.result} metrics={r.metrics} error={r.error} />)}
        </div>
      )}
    </div>
  );
}

function EditorTab({ versions, onSaved }: { versions: PromptVersion[]; onSaved: (id: string) => void }) {
  const [base, setBase] = useState("v3");
  const baseV = versions.find((v) => v.id === base);
  const [name, setName] = useState("");
  const [system, setSystem] = useState("");
  const [user, setUser] = useState("");
  const [temp, setTemp] = useState<string>("0");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    if (!baseV) return;
    setSystem(baseV.system_prompt ?? "");
    setUser(baseV.user_template);
    setTemp(baseV.temperature === null ? "" : String(baseV.temperature));
    setName(`${baseV.id} variant`);
  }, [baseV]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const v = await api.createPrompt({ name, system_prompt: system, user_template: user, temperature: temp === "" ? null : Number(temp), base_version: base, notes });
      setSaved(v.id);
      setError(null);
      onSaved(v.id);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label" htmlFor="ed-base">Start from</label>
          <select id="ed-base" className="input" value={base} onChange={(e) => setBase(e.target.value)}>{versions.map((v) => <option key={v.id} value={v.id}>{v.id} – {v.name}</option>)}</select></div>
        <div><label className="label" htmlFor="ed-name">New version name</label><input id="ed-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div><label className="label" htmlFor="ed-temp">Temperature (blank = provider default)</label><input id="ed-temp" className="input" type="number" min={0} max={2} step={0.1} value={temp} onChange={(e) => setTemp(e.target.value)} /></div>
      </div>
      <div><label className="label" htmlFor="ed-sys">System prompt (leave empty for none)</label><textarea id="ed-sys" className="input min-h-[220px] font-mono text-xs" value={system} onChange={(e) => setSystem(e.target.value)} /></div>
      <div><label className="label" htmlFor="ed-user">User prompt template — must contain {"{question}"} and {"{policy_excerpts}"}</label><textarea id="ed-user" className="input min-h-[120px] font-mono text-xs" value={user} onChange={(e) => setUser(e.target.value)} required /></div>
      <div><label className="label" htmlFor="ed-notes">What changed and why (goes into the iteration log)</label><textarea id="ed-notes" className="input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Added a third few-shot example because Hinglish questions were answered in Hinglish." /></div>
      {error && <ErrorBanner message={error} />}
      {saved && <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">Saved as <strong>{saved}</strong>. Select it in the Compare tab, or include it in an evaluation run.</div>}
      <div className="flex justify-end"><button className="btn-primary" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save as new version</button></div>
    </form>
  );
}

function VersionsTab({ versions, onDeleted }: { versions: PromptVersion[]; onDeleted: () => void }) {
  const [open, setOpen] = useState<string>("v3");
  const v = versions.find((x) => x.id === open);
  const del = async (id: string) => {
    if (!window.confirm(`Delete custom version ${id}?`)) return;
    await api.deletePrompt(id);
    setOpen("v3");
    onDeleted();
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <ul className="space-y-2">
        {versions.map((x) => (
          <li key={x.id}>
            <button onClick={() => setOpen(x.id)} className={cx("w-full rounded-xl border px-4 py-3 text-left", open === x.id ? "border-accent bg-accent-soft" : "border-line bg-white hover:bg-mist")}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-accent">{x.id}{!x.builtin && <Pill>custom</Pill>}</div>
              <div className="text-sm font-medium text-navy-900">{x.name}</div>
              <div className="text-xs text-slate-500">temperature {x.temperature ?? "default"} · {x.builtin ? x.source : fmtDate(x.created_at)}</div>
            </button>
          </li>
        ))}
      </ul>
      {v && (
        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-navy-900">{v.name}</h3>
            {!v.builtin && <button className="btn-ghost btn-sm text-rose-600" onClick={() => del(v.id)}><Trash2 size={14} /> Delete</button>}
          </div>
          {v.notes && <div className="rounded-xl bg-mist p-3 text-sm text-slate-700"><div className="label">What changed and why</div><pre className="whitespace-pre-wrap font-sans">{v.notes}</pre></div>}
          <PromptBlock label="System prompt" text={v.system_prompt} />
          <PromptBlock label="User prompt template" text={v.user_template} />
        </div>
      )}
    </div>
  );
}

function HistoryTab() {
  const { data, error, loading } = useApi(() => api.labRuns(), []);
  if (loading) return <Spinner label="Loading lab runs…" />;
  if (error) return <ErrorBanner message={error} />;
  if (!data?.length) return <EmptyState icon={<History size={20} />} title="No comparisons run yet">Comparisons need an LLM API key; each run is stored here with its metrics.</EmptyState>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-mist text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Version</th><th className="px-4 py-2.5">Question</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Format</th><th className="px-4 py-2.5">Quotes</th></tr></thead>
        <tbody className="divide-y divide-line">
          {data.map((r) => (
            <tr key={r.id}><td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtDate(r.created_at)}</td><td className="px-4 py-2.5"><Pill tone="navy">{r.version_id}</Pill></td><td className="px-4 py-2.5">{r.question}</td><td className="px-4 py-2.5"><StatusBadge status={r.metrics.status} /></td><td className="px-4 py-2.5">{r.metrics.format_ok ? "✓" : <XCircle size={14} className="text-rose-500" />}</td><td className="px-4 py-2.5">{r.metrics.quotes_verified}/{r.metrics.quotes_total}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VersionMetrics() {
  const { data } = useApi(() => api.evalRuns(), []);
  const latest = useMemo(() => {
    const out: Record<string, { run: number; m: Record<string, number | null> }> = {};
    for (const run of data ?? []) {
      if (run.status !== "completed" || run.suite !== "main" || !run.summary) continue;
      for (const [cfg, s] of Object.entries(run.summary.configs)) if (!out[cfg]) out[cfg] = { run: run.id, m: s.metrics as unknown as Record<string, number | null> };
    }
    return out;
  }, [data]);
  const cfgs = Object.keys(latest).filter((c) => c !== "system");
  if (!cfgs.length) {
    return (
      <div className="card flex flex-col gap-2 p-5 text-sm text-slate-600 sm:flex-row sm:items-center">
        <Beaker size={18} className="text-accent" />
        No prompt-version evaluation has been run yet. Run v1, v2 and v3 on the full test suite from the
        <Link to="/evaluation" className="font-medium text-accent hover:underline">Evaluation page</Link> (needs an LLM API key) to fill this chart with measured results.
      </div>
    );
  }
  const chart = METRIC_LABELS.map(([k, label]) => ({ metric: label, ...Object.fromEntries(cfgs.map((c) => [c, latest[c].m[k] === null ? null : Math.round((latest[c].m[k] as number) * 100)])) }));
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-navy-900">Measured performance by prompt version</h3>
      <p className="text-xs text-slate-500">From the latest completed evaluation run of each version on the 14-test suite. Lower is better for hallucination rate.</p>
      <div className="mt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e9f2" />
            <XAxis dataKey="metric" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Legend />
            {cfgs.map((c, i) => <Bar key={c} dataKey={c} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">{cfgs.map((c) => <span key={c}>{c}: run #{latest[c].run}, pass rate {pct(latest[c].m.pass_rate)}</span>)}</div>
    </div>
  );
}

export default function PromptLab() {
  const [tab, setTab] = useState<Tab>("compare");
  const versions = useApi<PromptVersion[]>(() => api.prompts(), []);
  const TABS: [Tab, string, typeof FlaskConical][] = [["compare", "Compare outputs", FlaskConical], ["editor", "Prompt editor", FileCode2], ["versions", "Version history", History], ["history", "Lab runs", Beaker]];
  return (
    <AppLayout>
      <PageHeader title="Prompt Engineering Lab" subtitle="Run the same question through V1 (baseline), V2 (context-grounded) and V3 (final), edit prompts, and see measured differences." />
      <div className="mb-5"><VersionMetrics /></div>
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-line">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={cx("flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium", tab === id ? "bg-navy-900 text-white" : "text-slate-600 hover:bg-mist")}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {versions.error && <ErrorBanner message={versions.error} onRetry={() => versions.reload()} />}
      {versions.loading && <Spinner label="Loading prompt versions…" />}
      {versions.data && (
        <>
          {tab === "compare" && <CompareTab versions={versions.data} />}
          {tab === "editor" && <EditorTab versions={versions.data} onSaved={() => versions.reload(true)} />}
          {tab === "versions" && <VersionsTab versions={versions.data} onDeleted={() => versions.reload(true)} />}
          {tab === "history" && <HistoryTab />}
        </>
      )}
    </AppLayout>
  );
}
