// Hash router for the hosted build. The claude.ai artifact frame only passes a plain
// #name between the page and its URL, so routes map to #dashboard, #chat, ... and the
// query part (?q=, ?id=) is kept in memory. Same exports as src/router.tsx.
import { AnchorHTMLAttributes, MouseEvent, useEffect, useState } from "react";

const NAMES = new Set(["dashboard", "chat", "library", "lab", "evaluation", "about"]);
const resolve = (h: string): string | null => (NAMES.has(h) ? `/${h}` : !h || h === "home" ? "/" : null);
const hashFor = (path: string) => `#${path.replace(/^\//, "").split("?")[0] || "home"}`;

let current = { path: resolve(location.hash.slice(1)) ?? "/", search: "" };
let pending: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

window.addEventListener("hashchange", () => {
  const h = location.hash.slice(1);
  const p = resolve(h);
  if (p === null) {
    document.getElementById(h)?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  current = { path: p, search: pending ?? "" };
  pending = null;
  emit();
  window.scrollTo({ top: 0 });
});

export function navigate(to: string) {
  const [p, s] = to.split("?");
  const search = s ? `?${s}` : "";
  const target = hashFor(p);
  if (location.hash === target || (!location.hash && target === "#home")) {
    current = { path: resolve(target.slice(1)) ?? "/", search };
    emit();
    window.scrollTo({ top: 0 });
  } else {
    pending = search;
    location.hash = target;
  }
}

export function useLocation() {
  const [loc, setLoc] = useState(current);
  useEffect(() => {
    const update = () => setLoc(current);
    listeners.add(update);
    update();
    return () => { listeners.delete(update); };
  }, []);
  return loc;
}

export function useQueryParam(name: string): string | null {
  return new URLSearchParams(useLocation().search).get(name);
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };
export function Link({ to, onClick, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || to.startsWith("#")) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to.startsWith("#") ? to : hashFor(to)} onClick={handle} {...rest} />;
}

/** On first load with an in-page anchor (#features), scroll to it once the page has rendered. */
export function scrollToInitialAnchor() {
  const h = location.hash.slice(1);
  if (h && resolve(h) === null) setTimeout(() => document.getElementById(h)?.scrollIntoView(), 50);
}
