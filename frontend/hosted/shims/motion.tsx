// Offline stand-in for framer-motion in the hosted build: renders the plain element,
// with a short CSS fade/slide when the component would have animated in.
import { createElement, forwardRef, Fragment, type ReactNode } from "react";

const MOTION_PROPS = new Set(["initial", "animate", "exit", "transition", "whileHover", "whileTap", "whileInView", "viewport", "layout", "variants"]);
const cache: Record<string, unknown> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const motion: any = new Proxy({}, {
  get: (_t, tag: string) =>
    (cache[tag] ??= forwardRef<HTMLElement, Record<string, unknown>>((p, ref) => {
      const rest: Record<string, unknown> = {};
      for (const k in p) if (!MOTION_PROPS.has(k)) rest[k] = p[k];
      const init = p.initial as Record<string, unknown> | undefined;
      const animates = init && typeof init === "object" && (init.opacity === 0 || init.y !== undefined) && init.height === undefined;
      if (animates) rest.className = `${(rest.className as string) ?? ""} cs-enter`;
      const style = p.style as Record<string, unknown> | undefined;
      if (style && style.rotate !== undefined) rest.style = { ...style, rotate: undefined, transform: `rotate(${style.rotate}deg)` };
      return createElement(tag, { ...rest, ref });
    })),
});

export const AnimatePresence = ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children);
