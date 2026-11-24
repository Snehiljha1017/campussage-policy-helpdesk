import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Eraser, MessageSquareText, Search } from "lucide-react";
import AnswerCard from "../components/AnswerCard";
import AppLayout, { DemoModeBanner } from "../components/AppLayout";
import { ErrorBanner, PageHeader } from "../components/ui";
import { useQueryParam } from "../router";
import { api } from "../services/api";
import type { ChatResponse } from "../services/types";

type Turn = { id: string; question: string; response?: ChatResponse; error?: string; pending?: boolean };

const SUGGESTIONS = [
  "What is the minimum attendance required to appear in end-semester examinations?",
  "Exam dene ke liye kitni attendance chahiye?",
  "How much is the late fee if I pay my semester fee after the due date?",
  "What is the deadline?",
  "Since guests can stay overnight in the hostel on weekends, how do I register my friend?",
  "What is the policy on international student exchange programmes?",
];

function Thinking() {
  return (
    <div className="card flex items-center gap-3 px-5 py-4 text-sm text-slate-500">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-2 w-2 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }} />
        ))}
      </span>
      Searching the policies and checking the evidence…
    </div>
  );
}

export default function Chat() {
  const initialQ = useQueryParam("q");
  const historyId = useQueryParam("id");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const started = useRef<string | null>(null);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const id = `${Date.now()}`;
    setTurns((t) => [...t, { id, question: q, pending: true }]);
    setInput("");
    setBusy(true);
    try {
      const response = await api.ask(q);
      setTurns((t) => t.map((x) => (x.id === id ? { id, question: q, response } : x)));
    } catch (e) {
      setTurns((t) => t.map((x) => (x.id === id ? { id, question: q, error: e instanceof Error ? e.message : String(e) } : x)));
    } finally {
      setBusy(false);
    }
  };

  // Pre-filled question (?q=) from the dashboard / landing page, or a past answer (?id=).
  useEffect(() => {
    const key = `${initialQ}|${historyId}`;
    if (started.current === key) return;
    started.current = key;
    if (initialQ) void ask(initialQ);
    else if (historyId) {
      api.historyItem(Number(historyId))
        .then((r) => setTurns([{ id: `h${historyId}`, question: r.question, response: r }]))
        .catch((e) => setTurns([{ id: "err", question: "Past question", error: e.message }]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ, historyId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const last = turns[turns.length - 1]?.response;
    // A reply to a clarifying question is combined with the original question.
    if (last?.status === "Needs Clarification" && last.flags.includes("ambiguous") && input.trim().split(/\s+/).length <= 6) {
      void ask(`${last.question.replace(/\?$/, "")} for ${input.trim()}?`);
    } else void ask(input);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e as unknown as FormEvent);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Ask CampusSage"
        subtitle="Answers come only from the indexed policy documents, with the exact clause quoted."
        actions={turns.length > 0 && <button className="btn-ghost btn-sm" onClick={() => setTurns([])}><Eraser size={14} /> Clear conversation</button>}
      />
      <DemoModeBanner />

      <div className="space-y-6 pb-40">
        {turns.length === 0 && (
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><MessageSquareText size={20} /></div>
              <div>
                <div className="font-semibold text-navy-900">Try one of these</div>
                <div className="text-sm text-slate-500">They cover a normal question, Hinglish, conflicting rules, ambiguity, a false assumption and an uncovered topic.</div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="flex items-start gap-2 rounded-xl border border-line px-3 py-2.5 text-left text-sm text-slate-700 hover:border-accent hover:bg-accent-soft/40">
                  <Search size={14} className="mt-0.5 shrink-0 text-slate-400" /> {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t) => (
          <div key={t.id} className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-navy-900 px-4 py-2.5 text-[15px] text-white">{t.question}</div>
            </div>
            {t.pending && <Thinking />}
            {t.error && <ErrorBanner message={t.error} onRetry={() => ask(t.question)} />}
            {t.response && <AnswerCard r={t.response} onFollowUp={(q) => ask(q)} />}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-4 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-4xl items-end gap-2">
          <textarea
            rows={1}
            className="input max-h-40 min-h-[48px] resize-none py-3 text-[15px]"
            placeholder="Ask about attendance, exams, fees, hostel or academic rules…"
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            aria-label="Your question"
          />
          <button className="btn-primary h-12 w-12 shrink-0 p-0" disabled={!input.trim() || busy} aria-label="Send">
            <ArrowUp size={18} />
          </button>
        </div>
        <p className="mx-auto mt-1.5 max-w-4xl text-[11px] text-slate-400">CampusSage reads published policies only. Confirm decisions that affect your record with the office named.</p>
      </form>
    </AppLayout>
  );
}
