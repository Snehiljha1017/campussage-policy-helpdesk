import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, ShieldAlert, XCircle } from "lucide-react";
import type { Confidence, Status } from "../services/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---- data loading -------------------------------------------------------- */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, deps);
  return { data, error, loading, reload, setData };
}

/* ---- brand ------------------------------------------------------------------ */
export function Logo({ light = false, size = 28 }: { light?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill={light ? "#fff" : "#0B1F3A"} />
        <path d="M9 11.5c0-1.4 1.1-2.5 2.5-2.5H16v14h-4.5C10.1 23 9 21.9 9 20.5z" fill="#93C5FD" />
        <path d="M23 11.5c0-1.4-1.1-2.5-2.5-2.5H16v14h4.5c1.4 0 2.5-1.1 2.5-2.5z" fill={light ? "#0B1F3A" : "#fff"} />
        <circle cx="16" cy="16" r="2" fill="#2563EB" />
      </svg>
      <span className={cx("text-[17px] font-semibold tracking-tight", light ? "text-white" : "text-navy-900")}>
        Campus<span className="text-accent">Sage</span>
      </span>
    </span>
  );
}

/* ---- badges ----------------------------------------------------------------- */
const STATUS_STYLE: Record<Status, { cls: string; icon: ReactNode }> = {
  Answered: { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: <CheckCircle2 size={13} /> },
  "Needs Clarification": { cls: "bg-amber-50 text-amber-700 ring-amber-200", icon: <CircleHelp size={13} /> },
  "Not Covered": { cls: "bg-slate-100 text-slate-700 ring-slate-200", icon: <XCircle size={13} /> },
  "Conflicting Evidence": { cls: "bg-rose-50 text-rose-700 ring-rose-200", icon: <AlertTriangle size={13} /> },
};

export function StatusBadge({ status }: { status: Status | string | null }) {
  const s = STATUS_STYLE[(status as Status) ?? "Not Covered"] ?? STATUS_STYLE["Not Covered"];
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", s.cls)}>
      {s.icon}
      {status ?? "Unknown"}
    </span>
  );
}

export function ConfidenceMeter({ level }: { level: Confidence }) {
  const n = level === "High" ? 3 : level === "Medium" ? 2 : 1;
  const color = level === "High" ? "bg-emerald-500" : level === "Medium" ? "bg-amber-500" : "bg-slate-400";
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-700" title={`${level} confidence`}>
      <span className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cx("h-3 w-1.5 rounded-sm", i <= n ? color : "bg-slate-200")} />
        ))}
      </span>
      {level}
    </span>
  );
}

export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "blue" | "green" | "amber" | "rose" | "navy" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-accent-soft text-accent",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
    navy: "bg-navy-900 text-white",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

/* ---- feedback states ---------------------------------------------------------- */
export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
      <Loader2 size={16} className="animate-spin" /> {label}
    </span>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <ShieldAlert size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button className="btn-ghost btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</div>
      <p className="font-medium text-navy-900">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-slate-200/70", className)} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold text-navy-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function pct(v: number | null | undefined) {
  return v === null || v === undefined ? "n/a" : `${Math.round(v * 100)}%`;
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
