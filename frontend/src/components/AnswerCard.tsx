import { ReactNode, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck, Building2, Check, ChevronDown, Copy, FileText, Info, ListChecks, ShieldAlert, ThumbsDown, ThumbsUp,
} from "lucide-react";
import { api } from "../services/api";
import type { ChatResponse, PipelineStep } from "../services/types";
import { ConfidenceMeter, cx, Pill, StatusBadge } from "./ui";

const FLAG_TEXT: Record<string, string> = {
  prompt_injection: "Instruction-like text in the question was ignored; only the policy question was answered.",
  personal_data_request: "CampusSage does not look up individual students' records.",
  unsupported_number: "A number in the generated answer was not found in the policy text.",
  citation_unverified: "The quotation could not be matched to the retrieved policy text.",
  ambiguous: "The question could refer to more than one policy.",
};

function copyText(r: ChatResponse) {
  const lines = [`Q: ${r.question}`, "", `Answer: ${r.answer}`];
  r.evidence.filter((e) => e.verified).forEach((e) => lines.push(`Evidence: "${e.quote}" (${e.document}, Section ${e.section})`));
  lines.push(`Confidence: ${r.confidence}`, `Status: ${r.status}`);
  return lines.join("\n");
}

function StepRow({ s }: { s: PipelineStep }) {
  const dot = { done: "bg-emerald-500", skipped: "bg-slate-300", stopped: "bg-navy-900", warning: "bg-amber-500" }[s.state];
  return (
    <li className="flex gap-3 py-1.5 text-xs">
      <span className="mt-1 flex w-4 shrink-0 justify-center">
        <span className={cx("h-2 w-2 rounded-full", dot)} />
      </span>
      <span className="w-40 shrink-0 font-medium text-navy-900">
        {s.n}. {s.name}
      </span>
      <span className="text-slate-500">
        {s.state === "stopped" && <strong className="mr-1 text-navy-900">Stopped:</strong>}
        {s.detail}
      </span>
    </li>
  );
}

function Disclosure({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-line">
      <button className="flex w-full items-center gap-2 px-5 py-3 text-left text-xs font-medium text-slate-600 hover:text-navy-900" onClick={() => setOpen(!open)} aria-expanded={open}>
        {icon}
        {title}
        <ChevronDown size={14} className={cx("ml-auto transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AnswerCard({ r, onFollowUp }: { r: ChatResponse; onFollowUp?: (q: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);
  const verified = r.evidence.filter((e) => e.verified);
  const unverified = r.evidence.filter((e) => !e.verified);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText(r));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFbError("Copy failed: your browser blocked clipboard access.");
    }
  };

  const sendFeedback = async (value: 1 | -1, withComment = false) => {
    if (!r.id) return;
    setRating(value);
    try {
      await api.feedback(r.id, value, withComment ? comment : undefined);
      setSent(withComment || value === 1);
      setFbError(null);
    } catch (e) {
      setFbError(e instanceof Error ? e.message : "Could not save feedback");
    }
  };

  return (
    <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <StatusBadge status={r.status} />
        <ConfidenceMeter level={r.confidence} />
        {r.mode === "demo" ? <Pill tone="amber">Demo mode · no LLM</Pill> : <Pill tone="blue">{r.model}</Pill>}
        <span className="ml-auto text-xs text-slate-400">{(r.latency_ms / 1000).toFixed(2)} s</span>
      </div>

      <div className="space-y-5 px-5 py-5">
        <section>
          <h3 className="label">Answer</h3>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{r.answer}</p>
        </section>

        {verified.length > 0 && (
          <section>
            <h3 className="label">Supporting evidence</h3>
            <div className="space-y-2.5">
              {verified.map((e, i) => (
                <figure key={i}>
                  <blockquote className="clause-quote">“{e.quote}”</blockquote>
                  <figcaption className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <BadgeCheck size={14} className="text-emerald-600" />
                    <span>Verified word for word in</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-navy-900 px-2 py-0.5 font-medium text-white">
                      <FileText size={12} /> {e.document}
                    </span>
                    <span className="rounded-md bg-accent-soft px-2 py-0.5 font-semibold text-accent">§ {e.section}</span>
                    {e.heading && <span>{e.heading}</span>}
                    {e.page && <span>· p.{e.page}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {unverified.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Unverified quotation:</strong> “{unverified[0].quote}” was not found in the retrieved policy text.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-mist p-3">
            <div className="label mb-1">Confidence</div>
            <ConfidenceMeter level={r.confidence} />
            <p className="mt-1 text-xs text-slate-500">{r.confidence_reason}</p>
          </div>
          <div className="rounded-xl bg-mist p-3">
            <div className="label mb-1">Source</div>
            {verified.length ? (
              <ul className="text-sm text-navy-900">
                {verified.map((e, i) => (
                  <li key={i}>
                    {e.document}, Section {e.section}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No policy clause cited.</p>
            )}
          </div>
        </div>

        {r.office_suggestion && (
          <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm text-navy-900">
            <Building2 size={16} className="text-accent" />
            Suggested office: <strong className="font-semibold">{r.office_suggestion}</strong>
          </div>
        )}

        {r.flags.filter((f) => FLAG_TEXT[f] && f !== "ambiguous").map((f) => (
          <div key={f} className="flex items-start gap-2 text-xs text-slate-600">
            <ShieldAlert size={14} className="mt-0.5 text-amber-600" /> {FLAG_TEXT[f]}
          </div>
        ))}

        {r.status === "Needs Clarification" && onFollowUp && (
          <p className="text-xs text-slate-500">Reply below with more detail and CampusSage will search again.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-mist/60 px-5 py-3">
        <button className="btn-ghost btn-sm" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy answer"}
        </button>
        <span className="ml-auto text-xs text-slate-500">Was this helpful?</span>
        <button
          aria-label="Helpful"
          className={cx("btn-ghost btn-sm", rating === 1 && "border-emerald-300 bg-emerald-50 text-emerald-700")}
          onClick={() => sendFeedback(1)}
          disabled={!r.id}
        >
          <ThumbsUp size={14} />
        </button>
        <button
          aria-label="Not helpful"
          className={cx("btn-ghost btn-sm", rating === -1 && "border-rose-300 bg-rose-50 text-rose-700")}
          onClick={() => sendFeedback(-1)}
          disabled={!r.id}
        >
          <ThumbsDown size={14} />
        </button>
      </div>
      {rating === -1 && !sent && (
        <div className="flex gap-2 border-t border-line px-5 py-3">
          <input className="input" placeholder="What was wrong? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn-primary btn-sm" onClick={() => sendFeedback(-1, true)}>
            Send
          </button>
        </div>
      )}
      {sent && <div className="border-t border-line px-5 py-2 text-xs text-emerald-700">Thanks, your feedback was saved.</div>}
      {fbError && <div className="border-t border-line px-5 py-2 text-xs text-rose-700">{fbError}</div>}

      <Disclosure title="How this answer was produced (10-step pipeline)" icon={<ListChecks size={14} />}>
        <ol>{r.pipeline.map((s) => <StepRow key={s.n} s={s} />)}</ol>
      </Disclosure>
      {r.retrieved.length > 0 && (
        <Disclosure title={`Retrieved policy excerpts (${r.retrieved.length})`} icon={<Info size={14} />}>
          <ul className="space-y-2">
            {r.retrieved.map((c) => (
              <li key={c.chunk_id} className="rounded-lg border border-line p-3 text-xs">
                <div className="mb-1 flex flex-wrap items-center gap-2 font-medium text-navy-900">
                  {c.document} <span className="text-accent">§ {c.section}</span>
                  <span className="ml-auto font-mono text-slate-400">score {c.score.toFixed(3)}</span>
                </div>
                <p className="text-slate-600">{c.text}</p>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </motion.article>
  );
}
