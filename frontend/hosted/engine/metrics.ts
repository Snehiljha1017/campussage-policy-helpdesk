// Port of backend/evaluation/metrics.py (same metric definitions).
import type { ChatResponse } from "../../src/services/types";

export interface TestCaseFull {
  id: string; type: "Normal" | "Edge" | "Invalid"; category: string; input: string; expected_output: string; expected_status: string[];
  expected_sources: { category: string; section: string }[]; require_all_sources: boolean; must_include: string[][]; must_not_match: string[];
}
export interface Checks {
  passed: boolean; status_ok: boolean; citation_correct: boolean | null; include_ok: boolean; exclude_ok: boolean; has_required_facts: boolean;
  hallucination: boolean; grounded: boolean | null; format_ok: boolean; unsupported_numbers: string[]; reasons: string[]; retrieved_doc: string; cited_source: string;
}

export function evaluateCase(c: TestCaseFull, r: ChatResponse): Checks {
  const status = r.status;
  const statusOk = c.expected_status.includes(status);
  const verified = (r.evidence ?? []).filter((e) => e.verified);
  const cited = new Set(verified.map((e) => `${e.category}|${e.section}`));
  const expected = (c.expected_sources ?? []).map((s) => `${s.category}|${s.section}`);
  const citationCorrect = expected.length ? (c.require_all_sources ? expected.every((e) => cited.has(e)) : expected.some((e) => cited.has(e))) : null;
  const text = `${r.answer ?? ""} ${(r.evidence ?? []).map((e) => e.quote ?? "").join(" ")}`.toLowerCase();
  const missing = (c.must_include ?? []).filter((grp) => !grp.some((alt) => text.includes(alt.toLowerCase())));
  const forbidden = (c.must_not_match ?? []).filter((p) => new RegExp(p, "i").test(r.answer ?? ""));
  const unsupported = r.citation?.unsupported_numbers ?? [];
  const hallucination = unsupported.length > 0 || (status === "Answered" && verified.length === 0);
  const formatOk = r.parsed ? r.parsed.format_ok : true;
  const passed = statusOk && citationCorrect !== false && !missing.length && !forbidden.length;
  const reasons: string[] = [];
  if (!statusOk) reasons.push(`status '${status}', expected ${c.expected_status.join(" or ")}`);
  if (citationCorrect === false) reasons.push("expected clause not among verified citations");
  if (missing.length) reasons.push("missing fact: " + missing[0].join(" / "));
  if (forbidden.length) reasons.push("forbidden content in answer");
  const top = r.retrieved?.[0];
  return {
    passed, status_ok: statusOk, citation_correct: citationCorrect, include_ok: !missing.length, exclude_ok: !forbidden.length,
    has_required_facts: (c.must_include ?? []).length > 0, hallucination, grounded: status === "Answered" ? verified.length > 0 : null,
    format_ok: formatOk, unsupported_numbers: unsupported, reasons,
    retrieved_doc: top ? `${top.document} §${top.section}` : "-",
    cited_source: verified.map((e) => `${e.document} §${e.section}`).join("; ") || "-",
  };
}

export interface RecordRow { config: string; test_id: string; test_type: string; repeat_idx: number; status: string; cited: string[]; checks: Checks }

const ratio = (n: number, d: number) => (d ? Math.round((n / d) * 10000) / 10000 : null);

export function summarise(records: RecordRow[]) {
  const byCfg = new Map<string, RecordRow[]>();
  for (const r of records) byCfg.set(r.config, [...(byCfg.get(r.config) ?? []), r]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const [cfg, rs] of byCfg) {
    const first = rs.filter((r) => r.repeat_idx === 0);
    const ch = rs.map((r) => r.checks);
    const answered = ch.filter((c) => c.grounded !== null);
    const withFacts = ch.filter((c) => c.has_required_facts);
    const withCites = ch.filter((c) => c.citation_correct !== null);
    const byType: Record<string, { total: number; passed: number }> = {};
    for (const r of first) {
      byType[r.test_type] ??= { total: 0, passed: 0 };
      byType[r.test_type].total++;
      byType[r.test_type].passed += Number(r.checks.passed);
    }
    const repeats = Math.max(...rs.map((r) => r.repeat_idx)) + 1;
    let consistency: number | null = null;
    if (repeats > 1) {
      const sig = new Map<string, Set<string>>();
      for (const r of rs) sig.set(r.test_id, (sig.get(r.test_id) ?? new Set()).add(`${r.status}|${[...r.cited].sort().join(",")}`));
      consistency = ratio([...sig.values()].filter((s) => s.size === 1).length, sig.size);
    }
    out[cfg] = {
      tests: first.length, outputs: rs.length, repeats,
      passed: first.filter((r) => r.checks.passed).length, failed: first.filter((r) => !r.checks.passed).length, by_type: byType,
      metrics: {
        pass_rate: ratio(ch.filter((c) => c.passed).length, ch.length),
        status_accuracy: ratio(ch.filter((c) => c.status_ok).length, ch.length),
        factual_correctness: ratio(withFacts.filter((c) => c.include_ok).length, withFacts.length),
        citation_accuracy: ratio(withCites.filter((c) => c.citation_correct).length, withCites.length),
        hallucination_rate: ratio(ch.filter((c) => c.hallucination).length, ch.length),
        policy_grounding: ratio(answered.filter((c) => c.grounded).length, answered.length),
        format_compliance: ratio(ch.filter((c) => c.format_ok).length, ch.length),
        consistency,
      },
    };
  }
  return out;
}
