import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, FileText, FileUp, Loader2, RefreshCw, Search, Trash2, UploadCloud, X } from "lucide-react";
import AppLayout from "../components/AppLayout";
import { cx, EmptyState, ErrorBanner, fmtDate, PageHeader, Pill, Skeleton, Spinner, useApi } from "../components/ui";
import { api } from "../services/api";
import type { DocumentDetail, DocumentRow, RetrievedChunk } from "../services/types";

const STATUS_TONE = { indexed: "green", processing: "blue", uploaded: "slate", failed: "rose" } as const;

function UploadPanel({ categories, onUploaded }: { categories: string[]; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) return setError("Only PDF files are supported.");
    if (f.size > 15 * 1024 * 1024) return setError("The file is larger than 15 MB.");
    setError(null);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "));
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    pick(e.dataTransfer.files?.[0]);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !category) return;
    setBusy(true);
    try {
      await api.upload(file, category, title);
      setFile(null);
      setTitle("");
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5">
      <h2 className="mb-3 font-semibold text-navy-900">Upload a policy PDF</h2>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cx("flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          drag ? "border-accent bg-accent-soft" : "border-line hover:border-accent/60 hover:bg-mist")}
        role="button"
        tabIndex={0}
        aria-label="Choose a PDF file"
      >
        <UploadCloud size={28} className="text-accent" />
        {file ? (
          <p className="mt-2 text-sm font-medium text-navy-900">{file.name} <span className="text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span></p>
        ) : (
          <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-accent">Click to choose</span> or drag a PDF here (max 15 MB)</p>
        )}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="doc-title">Title</label>
          <input id="doc-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Hostel Rules 2026-27" />
        </div>
        <div>
          <label className="label" htmlFor="doc-cat">Category</label>
          <select id="doc-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">Select a category…</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Upload only official, public documents. Remove personal data first.</p>
        <button className="btn-primary" disabled={!file || !category || busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />} Upload & index
        </button>
      </div>
    </form>
  );
}

function DocumentDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, error, loading } = useApi<DocumentDetail>(() => api.document(id), [id]);
  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-navy-950/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl" initial={{ x: 600 }} animate={{ x: 0 }} exit={{ x: 600 }} transition={{ type: "tween", duration: 0.22 }}>
        <div className="flex items-start justify-between border-b border-line p-5">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Extracted content</div>
            <h2 className="mt-1 font-semibold text-navy-900">{data?.title ?? "Loading…"}</h2>
            {data && <p className="mt-1 text-xs text-slate-500">{data.category} · {data.pages} page(s) · {data.chunk_count} clauses · {data.status_detail}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-navy-900"><X size={20} /></button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-5">
          {loading && <Spinner label="Loading clauses…" />}
          {error && <ErrorBanner message={error} />}
          {data && data.chunks.length === 0 && <p className="text-sm text-slate-500">No text has been extracted yet.</p>}
          <ol className="space-y-3">
            {data?.chunks.map((c) => (
              <li key={c.id} className="rounded-xl border border-line p-3">
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span className="rounded-md bg-accent-soft px-2 py-0.5 font-semibold text-accent">§ {c.section}</span>
                  <span className="font-medium text-navy-900">{c.heading}</span>
                  <span className="ml-auto text-slate-400">p.{c.page}</span>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{c.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </motion.aside>
    </>
  );
}

function SearchPanel() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<RetrievedChunk[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      setResults(await api.searchChunks(q, 6));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card p-5">
      <h2 className="font-semibold text-navy-900">Search inside documents</h2>
      <p className="mt-0.5 text-xs text-slate-500">Runs the same retrieval the chat uses and shows the raw ranked clauses with scores.</p>
      <form onSubmit={run} className="mt-3 flex gap-2">
        <input className="input" placeholder="e.g. visitors, re-evaluation, refund" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary" disabled={busy || !q.trim()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search</button>
      </form>
      {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
      {results && (
        <ul className="mt-4 space-y-2">
          {results.length === 0 && <li className="text-sm text-slate-500">No matching clauses.</li>}
          {results.map((r) => (
            <li key={r.chunk_id} className="rounded-xl border border-line p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-navy-900">{r.document}</span>
                <span className="rounded-md bg-accent-soft px-1.5 font-semibold text-accent">§ {r.section}</span>
                <span className="ml-auto font-mono text-slate-400">score {r.score.toFixed(3)} · coverage {Math.round((r.term_coverage ?? 0) * 100)}%</span>
              </div>
              <p className="text-slate-700">{r.text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Library() {
  const docs = useApi<DocumentRow[]>(() => api.documents(), []);
  const cats = useApi<string[]>(() => api.categories(), []);
  const [filter, setFilter] = useState("All");
  const [viewing, setViewing] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingSamples, setLoadingSamples] = useState(false);

  // Poll while any document is still being processed.
  const processing = docs.data?.some((d) => d.status === "processing" || d.status === "uploaded");
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => docs.reload(true), 1500);
    return () => clearInterval(t);
  }, [processing, docs.reload]);

  const shown = useMemo(() => (docs.data ?? []).filter((d) => filter === "All" || d.category === filter), [docs.data, filter]);

  const act = async (id: number, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
      setActionError(null);
      await docs.reload(true);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };
  const remove = (d: DocumentRow) => {
    if (window.confirm(`Delete “${d.title}” and its ${d.chunk_count} indexed clauses? This cannot be undone.`)) void act(d.id, () => api.deleteDocument(d.id));
  };
  const loadSamples = async () => {
    setLoadingSamples(true);
    try { await api.loadSamples(); await docs.reload(true); } catch (e) { setActionError(e instanceof Error ? e.message : String(e)); } finally { setLoadingSamples(false); }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Policy Library"
        subtitle="Upload official PDFs. Each one is extracted, split into clauses, embedded and indexed for retrieval."
        actions={<button className="btn-ghost btn-sm" onClick={loadSamples} disabled={loadingSamples}>{loadingSamples ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Load sample documents</button>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <UploadPanel categories={cats.data ?? []} onUploaded={() => docs.reload(true)} />
        <SearchPanel />
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <h2 className="mr-2 font-semibold text-navy-900">Documents</h2>
          {["All", ...(cats.data ?? [])].map((c) => (
            <button key={c} onClick={() => setFilter(c)} className={cx("rounded-full px-3 py-1 text-xs font-medium", filter === c ? "bg-navy-900 text-white" : "bg-mist text-slate-600 hover:bg-slate-200")}>{c}</button>
          ))}
        </div>
        {actionError && <div className="p-4"><ErrorBanner message={actionError} /></div>}
        {docs.loading ? <div className="p-4"><Skeleton className="h-40" /></div> : docs.error ? <div className="p-4"><ErrorBanner message={docs.error} onRetry={() => docs.reload()} /></div> : shown.length === 0 ? (
          <div className="p-6"><EmptyState icon={<FileText size={20} />} title="No documents in this category">Upload a PDF above, or load the labelled sample documents.</EmptyState></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-mist text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5">Document</th><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5">Uploaded</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Clauses</th><th className="px-4 py-2.5 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                <AnimatePresence initial={false}>
                  {shown.map((d) => (
                    <motion.tr key={d.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-navy-900">{d.title}{d.is_sample ? <Pill tone="amber">Sample</Pill> : null}</div>
                        <div className="text-xs text-slate-400">{d.filename}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{d.category}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(d.uploaded_at)}</td>
                      <td className="px-4 py-3">
                        <span title={d.status_detail ?? ""}><Pill tone={STATUS_TONE[d.status]}>{d.status === "processing" && <Loader2 size={12} className="animate-spin" />}{d.status}</Pill></span>
                        {d.status === "failed" && <div className="mt-1 max-w-xs text-xs text-rose-600">{d.status_detail}</div>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{d.chunk_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button className="btn-ghost btn-sm" onClick={() => setViewing(d.id)} aria-label={`View ${d.title}`}><Eye size={14} /></button>
                          <button className="btn-ghost btn-sm" onClick={() => act(d.id, () => api.reindex(d.id))} disabled={busyId === d.id} aria-label={`Re-index ${d.title}`}>
                            <RefreshCw size={14} className={cx(busyId === d.id && "animate-spin")} />
                          </button>
                          <button className="btn-ghost btn-sm hover:border-rose-200 hover:text-rose-600" onClick={() => remove(d)} disabled={busyId === d.id} aria-label={`Delete ${d.title}`}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AnimatePresence>{viewing !== null && <DocumentDrawer id={viewing} onClose={() => setViewing(null)} />}</AnimatePresence>
    </AppLayout>
  );
}
