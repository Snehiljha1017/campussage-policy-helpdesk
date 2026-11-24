// LLM access for the hosted build. On claude.ai the page may ask Claude through the
// artifact runtime's `sample` capability (the viewer is asked for consent on first use).
// Anywhere else this resolves to null and the app runs in labelled demo mode.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SampleFn = ((input: unknown, opts?: Record<string, unknown>) => Promise<{ text: string; truncated?: boolean; modelApplied?: string }>) | null;

let samplePromise: Promise<SampleFn> | null = null;
let denied = false;
export const MODEL_LABEL = "Claude (via claude.ai)";

export function getSample(): Promise<SampleFn> {
  if (!samplePromise) {
    samplePromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = (globalThis as any).claude;
      if (!c || typeof c.use !== "function") return null;
      try {
        return (await c.use("sample")) as SampleFn;
      } catch {
        return null;
      }
    })();
  }
  return samplePromise;
}

export async function llmAvailable(): Promise<boolean> {
  return !denied && (await getSample()) !== null;
}

export class LLMUnavailable extends Error {}

export interface LLMResult { text: string; model: string; latency_ms: number }

/** The runtime has no system role, so the system prompt is sent first in the single user turn, clearly delimited. */
export function composeMessage(system: string | null, user: string): string {
  return system ? `<system_prompt>\n${system}\n</system_prompt>\n\n${user}` : user;
}

export async function generate(system: string | null, user: string): Promise<LLMResult> {
  const sample = await getSample();
  if (!sample || denied) throw new LLMUnavailable("Claude is not available in this view.");
  const t0 = performance.now();
  try {
    const res = await sample([{ role: "user", content: composeMessage(system, user) }], { cache: false, modelTier: "default" });
    return { text: res.text ?? "", model: res.modelApplied ? `Claude ${res.modelApplied} (claude.ai)` : MODEL_LABEL, latency_ms: Math.round(performance.now() - t0) };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err?.code === "not_granted") {
      denied = true;
      throw new LLMUnavailable("Permission to use Claude was not granted, so CampusSage switched to demo mode.");
    }
    if (err?.code === "rate_limited") throw new Error("Claude's rate limit was reached. Please wait a minute and try again.");
    throw new Error(`Claude call failed: ${err?.message ?? String(e)}`);
  }
}
