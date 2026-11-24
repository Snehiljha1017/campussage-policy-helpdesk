// Small offline stand-in for the parts of Recharts the pages use (hosted build only):
// grouped/stacked bar charts with axes, legend and value tooltips, and a donut chart.
import { Children, createElement as h, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";

type Row = Record<string, string | number | null>;
type AnyProps = Record<string, unknown>;

export const Bar = (_: AnyProps) => null;
export const XAxis = (_: AnyProps) => null;
export const YAxis = (_: AnyProps) => null;
export const CartesianGrid = (_: AnyProps) => null;
export const Tooltip = (_: AnyProps) => null;
export const Legend = (_: AnyProps) => null;
export const Cell = (_: AnyProps) => null;
export const Pie = (_: AnyProps) => null;

const kids = (children: ReactNode) => Children.toArray(children).filter(isValidElement) as ReactElement<AnyProps>[];
const find = (children: ReactNode, type: unknown) => kids(children).find((c) => c.type === type);
const all = (children: ReactNode, type: unknown) => kids(children).filter((c) => c.type === type);

export function ResponsiveContainer({ children }: { width?: string | number; height?: string | number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const child = kids(children)[0];
  return h("div", { ref, style: { width: "100%", height: "100%", position: "relative" } },
    size.w > 0 && child ? h(child.type as never, { ...child.props, width: size.w, height: size.h }) : null);
}

function LegendRow({ items }: { items: { label: string; color: string }[] }) {
  return h("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", fontSize: 11, color: "#475467" } },
    items.map((it) => h("span", { key: it.label, style: { display: "inline-flex", alignItems: "center", gap: 5 } },
      h("span", { style: { width: 10, height: 10, borderRadius: 2, background: it.color } }), it.label)));
}

export function BarChart({ data, children, width = 400, height = 240 }: { data: Row[]; children: ReactNode; width?: number; height?: number; margin?: unknown }) {
  const bars = all(children, Bar).map((b) => ({ key: String(b.props.dataKey), fill: String(b.props.fill ?? "#2563eb"), stack: b.props.stackId as string | undefined }));
  const xKey = String(find(children, XAxis)?.props.dataKey ?? "name");
  const yProps = find(children, YAxis)?.props ?? {};
  const unit = (yProps.unit as string) ?? "";
  const showLegend = !!find(children, Legend);
  const legendH = showLegend ? 26 : 0;
  const pad = { l: 40, r: 8, t: 8, b: 34 };
  const W = width, H = height - legendH;
  const pw = Math.max(10, W - pad.l - pad.r), ph = Math.max(10, H - pad.t - pad.b);
  const stacked = bars.some((b) => b.stack);
  const values = data.map((r) => (stacked ? bars.reduce((s, b) => s + Number(r[b.key] ?? 0), 0) : Math.max(0, ...bars.map((b) => Number(r[b.key] ?? 0)))));
  const domain = yProps.domain as [number, number] | undefined;
  const max = domain?.[1] ?? Math.max(1, ...values);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * max));
  const band = pw / Math.max(1, data.length);
  const groups = stacked ? 1 : bars.length;
  const bw = Math.min(28, (band * 0.7) / groups);
  const y = (v: number) => pad.t + ph - (Math.min(v, max) / max) * ph;
  const els: ReactNode[] = [];
  ticks.forEach((t, i) => {
    els.push(h("line", { key: `g${i}`, x1: pad.l, x2: W - pad.r, y1: y(t), y2: y(t), stroke: "#e4e9f2", strokeDasharray: "3 3" }));
    els.push(h("text", { key: `t${i}`, x: pad.l - 6, y: y(t) + 4, textAnchor: "end", fontSize: 10, fill: "#64748b" }, `${t}${unit}`));
  });
  data.forEach((r, i) => {
    const cx = pad.l + band * i + band / 2;
    let acc = 0;
    bars.forEach((b, j) => {
      const v = Number(r[b.key] ?? 0);
      const x = stacked ? cx - bw / 2 : cx - (groups * bw) / 2 + j * bw;
      const top = y(acc + v), bottom = y(acc);
      els.push(h("rect", { key: `b${i}-${j}`, x, y: top, width: Math.max(1, bw - 2), height: Math.max(0, bottom - top), fill: b.fill, rx: 2 },
        h("title", null, `${r[xKey]} · ${b.key}: ${v}${unit}`)));
      if (stacked) acc += v;
    });
    const label = String(r[xKey] ?? "");
    els.push(h("text", { key: `x${i}`, x: cx, y: H - pad.b + 16, textAnchor: "middle", fontSize: 11, fill: "#475467" },
      label.length > 18 && band < 110 ? label.slice(0, 16) + "…" : label));
  });
  return h("div", null,
    h("svg", { width: W, height: H, role: "img" }, ...els),
    showLegend ? h(LegendRow, { items: bars.map((b) => ({ label: b.key, color: b.fill })) }) : null);
}

export function PieChart({ children, width = 300, height = 240 }: { children: ReactNode; width?: number; height?: number }) {
  const pie = find(children, Pie);
  if (!pie) return null;
  const data = (pie.props.data as Row[]) ?? [];
  const valueKey = String(pie.props.dataKey ?? "value"), nameKey = String(pie.props.nameKey ?? "name");
  const fills = all(pie.props.children as ReactNode, Cell).map((c) => String(c.props.fill));
  const showLegend = !!find(children, Legend);
  const H = height - (showLegend ? 26 : 0);
  const cx = width / 2, cy = H / 2;
  const R = Math.min(Number(pie.props.outerRadius ?? 85), Math.min(width, H) / 2 - 4), r = Math.min(Number(pie.props.innerRadius ?? 50), R - 12);
  const total = data.reduce((s, d) => s + Number(d[valueKey] ?? 0), 0) || 1;
  let a0 = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const v = Number(d[valueKey] ?? 0), a1 = a0 + (v / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
    const path = v >= total
      ? `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx - R} ${cy} M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`
      : `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`;
    a0 = a1;
    return h("path", { key: i, d: path, fill: fills[i] ?? "#94a3b8", fillRule: "evenodd", stroke: "#fff", strokeWidth: 2 }, h("title", null, `${d[nameKey]}: ${v}`));
  });
  return h("div", null,
    h("svg", { width, height: H, role: "img" }, ...arcs,
      h("text", { x: cx, y: cy + 6, textAnchor: "middle", fontSize: 18, fontWeight: 600, fill: "#0b1f3a" }, String(total))),
    showLegend ? h(LegendRow, { items: data.map((d, i) => ({ label: String(d[nameKey]), color: fills[i] ?? "#94a3b8" })) }) : null);
}
