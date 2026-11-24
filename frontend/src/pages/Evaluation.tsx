import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, ClipboardList, Download, FileText, FlaskConical, Loader2, Play, ShieldQuestion, Target, XCircle } from "lucide-react";
import AppLayout, { DemoModeBanner } from "../components/AppLayout";
import { cx, EmptyState, ErrorBanner, fmtDate, PageHeader, pct, Pill, Skeleton, StatCard, useApi } from "../components/ui";
import { api } from "../services/api";
import type { EvalRun, EvalRunDetail, PromptVersion } from "../services/types";

const TYPE_FILTERS = ["All", "Normal", "Edge", "Invalid"] as const;
const PIE_COLORS = { Normal: "#1d4ed8", Edge: "#f59e0b", Invalid: "#e11d48" } as const;

function RunControls({ versions, onStarted, disabled }: { versions: PromptVersion[]; onStarted: (id: number) => void; disabled: boolean }) {
  const [configs, setConfigs] = useState<string[]>(["system"]);
  const [repeats, setRepeats] = useState(1);
  const [suite, setSuite] = useState<"main" | "holdout">("main");
  const [error, setError] = useState<string | null>(null);
  const options = ["system", ...versions.filter((v) => v.id !== "final").map((v) => v.id)];
  const toggle = (c: string) => setConfigs((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  const start = async () => {
    try { const { run_id } = await api.startEval(configs, repeats, suite); setError(null); onStarted(run_id); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div className="card p-5">
      <h2 className="font-semibold text-navy-900">Run the test suite</h2>
      <p className="mt-0.5 text-xs text-slate-500"><strong>system</strong> = the production pipeline (guards + final prompt). <strong>v1–v3</strong> = prompt-only runs with identical retrieval, used to measure prompt changes (need an LLM key).</p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <div className="label">Configurations</div>
          <div className="flex flex-wrap gap-2">
            {options.map((c) => (
              <label key={c} className={cx("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium", configs.includes(c) ? "border-accent bg-accent-soft text-accent" : "border-line text-slate-600")}>
                <input type="checkbox" className="accent-blue-600" checked={configs.includes(c)} onChange={() => toggle(c)} /> {c}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ev-suite">Suite</label>
          <select id="ev-suite" className="input py-1.5" value={suite} onChange={(e) => setSuite(e.target.value as "main" | "holdout")}><option value="main">main (14 tests)</option><option value="holdout">holdout (8 tests)</option></select>
        </div>
        <div>
          <label className="label" htmlFor="ev-rep">Repeats</label>
          <select id="ev-rep" className="input py-1.5" value={repeats} onChange={(e) => setRepeats(Number(e.target.value))}>{[1, 2, 3, 5].map((n) => <option key={n}>{n}</option>)}</select>
        </div>
        <button className="btn-primary ml-auto" onClick={start} disabled={disabled || configs.length === 0}>
          {disabled ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {disabled ? "Running…" : "Start run"}
        </button>
      </div>
      {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
    </div>
  );
}

export default function Evaluation() {
  const runs = useApi<EvalRun[]>(() => api.evalRuns(), []);
  const versions = useApi<PromptVersion[]>(() => api.prompts(), []);
  const [runId, setRunId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EvalRunDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>("All");
  const [config, setConfig] = useState<string>("system");
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const runExport = async (fn: () => Promise<string>) => {
    try { setExportMsg(await fn()); } catch (e) { setExportMsg(e instanceof Error ? e.message : String(e)); }
    setTimeout(() => setExportMsg(null), 4000);
  };

  const running = runs.data?.find((r) => r.status === "running");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => runs.reload(true), 1500);
    return () => clearInterval(t);
  }, [running, runs.reload]);

  // Default to the newest completed run.
  useEffect(() => {
    if (runId === null && runs.data?.length) {
      const done = runs.data.find((r) => r.status === "completed");
      if (done) setRunId(done.id);
    }
  }, [runs.data, runId]);
  useEffect(() => {
    if (runId === null) return;
    const r = runs.data?.find((x) => x.id === runId);
    if (r?.status === "running") return;
    api.evalRun(runId).then((d) => {
      setDetail(d);
      setDetailError(null);
      const cfgs = Object.keys(d.summary?.configs ?? {});
      setConfig((c) => (cfgs.includes(c) ? c : cfgs[0] ?? "system"));
    }).catch((e) => setDetailError(e.message));
  }, [runId, runs.data]);

  const summary = detail?.summary?.configs?.[config];
  const rows = useMemo(() => (detail?.results ?? []).filter((r) => r.Config === config && r.Repeat === 1 && (typeFilter === "All" || r.Type === typeFilter)), [detail, config, typeFilter]);
  const allRows = useMemo(() => (detail?.results ?? []).filter((r) => r.Config === config && r.Repeat === 1), [detail, config]);
  const edgeCount = allRows.filter((r) => r.Type !== "Normal").length;
  // Questions the policies cannot answer (expected status Not Covered), counted from this run's own rows.
  const unsupportedQs = allRows.filter((r) => r["Expected Output"].startsWith("Not Covered")).length;

  const configChart = Object.entries(detail?.summary?.configs ?? {}).map(([c, s]) => ({
    config: c, "Pass rate": Math.round((s.metrics.pass_rate ?? 0) * 100), "Citation accuracy": Math.round((s.metrics.citation_accuracy ?? 0) * 100),
    "Hallucination rate": Math.round((s.metrics.hallucination_rate ?? 0) * 100), "Format compliance": Math.round((s.metrics.format_compliance ?? 0) * 100),
  }));
  const typeChart = Object.entries(summary?.by_type ?? {}).map(([t, v]) => ({ type: t, Passed: v.passed, Failed: v.total - v.passed }));
  const pieData = Object.entries(summary?.by_type ?? {}).map(([t, v]) => ({ name: t, value: v.total }));

  return (
    <AppLayout>
      <PageHeader
        title="Testing & Evaluation"
        subtitle="Every number below is computed from stored outputs of real runs against this implementation."
        actions={detail && (
          <>
            {exportMsg && <span className="self-center text-xs text-slate-500">{exportMsg}</span>}
            <button className="btn-ghost btn-sm" onClick={() => runExport(() => api.exportCsv(detail.id))}><Download size={14} /> Export CSV</button>
            <button className="btn-ghost btn-sm" onClick={() => runExport(() => api.exportMarkdown(detail.id))}><FileText size={14} /> Markdown table</button>
          </>
        )}
      />
      <DemoModeBanner />
      <RunControls versions={versions.data ?? []} disabled={!!running} onStarted={(id) => { setRunId(id); setDetail(null); void runs.reload(true); }} />

      {running && (
        <div className="card mt-4 p-4">
          <div className="flex items-center justify-between text-sm"><span className="font-medium text-navy-900">Run #{running.id} in progress ({running.configs.join(", ")})</span><span className="tabular-nums text-slate-500">{running.progress}/{running.total}</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-accent transition-all" style={{ width: `${running.total ? (100 * running.progress) / running.total : 0}%` }} /></div>
        </div>
      )}
      {runs.error && <div className="mt-4"><ErrorBanner message={runs.error} onRetry={() => runs.reload()} /></div>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="label mb-0" htmlFor="ev-run">Run</label>
        <select id="ev-run" className="input w-auto py-1.5" value={runId ?? ""} onChange={(e) => setRunId(Number(e.target.value))}>
          {(runs.data ?? []).map((r) => <option key={r.id} value={r.id} disabled={r.status === "running"}>#{r.id} · {r.suite} · {r.mode}{r.model ? ` (${r.model})` : ""} · {r.configs.join("+")} · {r.status} · {fmtDate(r.started_at)}</option>)}
        </select>
        <label className="label mb-0" htmlFor="ev-cfg">Configuration</label>
        <select id="ev-cfg" className="input w-auto py-1.5" value={config} onChange={(e) => setConfig(e.target.value)}>
          {Object.keys(detail?.summary?.configs ?? {}).map((c) => <option key={c}>{c}</option>)}
        </select>
        {detail?.summary?.demo_mode && <Pill tone="amber">demo mode run · no LLM</Pill>}
        {detail?.status === "failed" && <Pill tone="rose">failed: {detail.error?.split("\n")[0]}</Pill>}
        {detail?.status === "completed" && detail.error && <span className="text-xs text-slate-500">{detail.error}</span>}
      </div>
      {detail?.summary && Object.keys(detail.summary.skipped).length > 0 && (
        <p className="mt-2 text-xs text-slate-500">Skipped in this run: {Object.entries(detail.summary.skipped).map(([c, why]) => `${c} (${why})`).join("; ")}</p>
      )}
      {detailError && <div className="mt-4"><ErrorBanner message={detailError} /></div>}

      {!runs.loading && !runs.data?.length && (
        <div className="mt-6"><EmptyState icon={<ClipboardList size={20} />} title="No evaluation runs yet">Start a run above. The system configuration works without an API key.</EmptyState></div>
      )}
      {runs.loading && <Skeleton className="mt-6 h-40" />}

      {summary && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <StatCard label="Total tests" value={summary.tests} icon={<ClipboardList size={16} />} />
            <StatCard label="Passed" value={<span className="text-emerald-600">{summary.passed}</span>} icon={<CheckCircle2 size={16} />} />
            <StatCard label="Failed" value={<span className={summary.failed ? "text-rose-600" : ""}>{summary.failed}</span>} icon={<XCircle size={16} />} />
            <StatCard label="Edge + invalid" value={edgeCount} icon={<FlaskConical size={16} />} />
            <StatCard label="Unsupported Qs" value={unsupportedQs} hint="expect Not Covered" icon={<ShieldQuestion size={16} />} />
            <StatCard label="Citation accuracy" value={pct(summary.metrics.citation_accuracy)} icon={<Target size={16} />} />
            <StatCard label="Hallucination" value={pct(summary.metrics.hallucination_rate)} hint="lower is better" />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <h3 className="font-semibold text-navy-900">Performance by configuration</h3>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={configChart} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e9f2" />
                    <XAxis dataKey="config" tick={{ fontSize: 12 }} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Legend />
                    <Bar dataKey="Pass rate" fill="#0b1f3a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Citation accuracy" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Format compliance" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Hallucination rate" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-navy-900">Test mix</h3>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                      {pieData.map((d) => <Cell key={d.name} fill={PIE_COLORS[d.name as keyof typeof PIE_COLORS] ?? "#94a3b8"} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div className="card p-5">
              <h3 className="font-semibold text-navy-900">Pass / fail by test type</h3>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeChart} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e9f2" />
                    <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="Passed" stackId="a" fill="#10b981" />
                    <Bar dataKey="Failed" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-5 lg:col-span-2">
              <h3 className="font-semibold text-navy-900">All metrics · {config}</h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                {Object.entries(summary.metrics).map(([k, v]) => (
                  <div key={k}><dt className="text-xs capitalize text-slate-500">{k.replace(/_/g, " ")}</dt><dd className="text-lg font-semibold text-navy-900">{pct(v)}</dd></div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-slate-500">Definitions are in <code>backend/evaluation/metrics.py</code>. Consistency needs repeats &gt; 1.</p>
            </div>
          </div>

          <div className="card mt-5 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
              <h3 className="mr-2 font-semibold text-navy-900">Test cases</h3>
              {TYPE_FILTERS.map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)} className={cx("rounded-full px-3 py-1 text-xs font-medium", typeFilter === t ? "bg-navy-900 text-white" : "bg-mist text-slate-600 hover:bg-slate-200")}>{t}</button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-mist text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-2.5">Test ID</th><th className="px-4 py-2.5">Input</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Expected output</th><th className="px-4 py-2.5">Actual output</th><th className="px-4 py-2.5">Retrieved</th><th className="px-4 py-2.5">Citation</th><th className="px-4 py-2.5">Pass/Fail</th></tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {rows.map((r) => (
                    <tr key={r["Test ID"]}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-navy-900">{r["Test ID"]}</td>
                      <td className="max-w-[200px] px-4 py-3">{r.Input}</td>
                      <td className="px-4 py-3"><Pill tone={r.Type === "Normal" ? "blue" : r.Type === "Edge" ? "amber" : "rose"}>{r.Type}</Pill></td>
                      <td className="max-w-[220px] px-4 py-3 text-slate-600">{r["Expected Output"]}</td>
                      <td className="max-w-[280px] px-4 py-3"><div className="text-xs font-semibold text-navy-900">{r["Actual Status"]}</div><div className="line-clamp-4 text-slate-600">{r["Actual Output"]}</div></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r["Retrieved Document"]}</td>
                      <td className="px-4 py-3 text-xs">{r["Citation Correct"]}</td>
                      <td className="px-4 py-3">
                        <Pill tone={r["Pass/Fail"] === "Pass" ? "green" : "rose"}>{r["Pass/Fail"]}</Pill>
                        {r["Failure Reasons"] && <div className="mt-1 max-w-[180px] text-xs text-rose-600">{r["Failure Reasons"]}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
