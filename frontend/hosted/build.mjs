// Build the hosted, backend-free CampusSage page (for a claude.ai artifact or any static host).
//   cd frontend && npm install && npm run build:hosted      -> hosted/dist/{index.html,app.js,app.css,pdf.worker.min.mjs}
//   npm run build:pages                                     -> ../app/ (served by GitHub Pages)
// It bundles the same React app as `npm run build`, swapping:
//   src/services/api.ts -> hosted/api.ts (in-browser engine)     src/router.tsx -> hosted/router.tsx (#hash routes)
//   lucide-react / recharts / framer-motion -> real packages if installed, else small offline stand-ins in hosted/shims.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOSTED = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HOSTED, "..");
const OUT = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.join(HOSTED, "dist");
const NODE_DIRS = [path.join(FRONTEND, "node_modules"), process.env.CAMPUSSAGE_EXTRA_NODE_MODULES].filter((d) => d && fs.existsSync(d));
const pkgDir = (name) => NODE_DIRS.map((d) => path.join(d, name)).find((p) => fs.existsSync(p));
const need = (name) => pkgDir(name) ?? (() => { throw new Error(`Missing package ${name}: run npm install in frontend/`); })();

const esbuild = await import(pathToFileURL(path.join(need("esbuild"), "lib", "main.js")).href);
const { compile } = await import(pathToFileURL(path.join(need("tailwindcss"), "dist", "lib.mjs")).href);

const useReal = Object.fromEntries(["lucide-react", "recharts", "framer-motion"].map((n) => [n, !!pkgDir(n) && process.env.CAMPUSSAGE_SHIMS !== "1"]));
const SHIMS = { "lucide-react": "icons.tsx", recharts: "charts.tsx", "framer-motion": "motion.tsx" };

const swap = {
  name: "campussage-hosted-swap",
  setup(b) {
    b.onResolve({ filter: /(^|\/)services\/api$/ }, (a) => (a.importer.includes(`${path.sep}src${path.sep}`) ? { path: path.join(HOSTED, "api.ts") } : undefined));
    b.onResolve({ filter: /(^|\/)router$/ }, (a) => (a.importer.includes(`${path.sep}src${path.sep}`) ? { path: path.join(HOSTED, "router.tsx") } : undefined));
    for (const [name, file] of Object.entries(SHIMS)) {
      if (!useReal[name]) b.onResolve({ filter: new RegExp(`^${name}$`) }, () => ({ path: path.join(HOSTED, "shims", file) }));
    }
  },
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(HOSTED, "main.tsx")],
  bundle: true, minify: true, format: "esm", target: "es2022", jsx: "automatic", outfile: path.join(OUT, "app.js"),
  loader: { ".css": "empty" }, nodePaths: NODE_DIRS, plugins: [swap], legalComments: "none", logLevel: "warning",
  define: { "process.env.NODE_ENV": '"production"' },
});

// Tailwind v4: compile src/index.css against every class-like token in the sources.
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== "dist") walk(p); } else if (/\.(tsx?|css)$/.test(f)) files.push(p); } })(path.join(FRONTEND, "src"));
for (const f of fs.readdirSync(HOSTED)) if (/\.tsx?$/.test(f)) files.push(path.join(HOSTED, f));
const candidates = new Set();
for (const f of files) for (const t of fs.readFileSync(f, "utf8").split(/[\s"'`{}()<>,;=]+/)) if (t) candidates.add(t);
const tw = need("tailwindcss");
const compiler = await compile(fs.readFileSync(path.join(FRONTEND, "src", "index.css"), "utf8"), {
  base: FRONTEND,
  loadStylesheet: async (id) => {
    const p = id === "tailwindcss" ? path.join(tw, "index.css") : path.join(tw, id.replace(/^tailwindcss\//, ""));
    return { path: p, base: path.dirname(p), content: fs.readFileSync(p, "utf8") };
  },
});
const extra = `.cs-enter{animation:cs-enter .35s ease-out both}@keyframes cs-enter{from{opacity:0;transform:translateY(6px)}}
@media (prefers-reduced-motion:reduce){.cs-enter{animation:none}}`;
fs.writeFileSync(path.join(OUT, "app.css"), compiler.build([...candidates]) + extra);

fs.copyFileSync(path.join(need("pdfjs-dist"), "build", "pdf.worker.min.mjs"), path.join(OUT, "pdf.worker.min.mjs"));
fs.writeFileSync(path.join(OUT, "index.html"), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="CampusSage - AI-powered university policy helpdesk with cited, source-grounded answers." />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%230B1F3A'/><path d='M9 11.5c0-1.4 1.1-2.5 2.5-2.5H16v14h-4.5C10.1 23 9 21.9 9 20.5z' fill='%2393C5FD'/><path d='M23 11.5c0-1.4-1.1-2.5-2.5-2.5H16v14h4.5c1.4 0 2.5-1.1 2.5-2.5z' fill='%23fff'/><circle cx='16' cy='16' r='2' fill='%232563EB'/></svg>" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="app.css" />
<title>CampusSage</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="app.js"></script>
</body>
</html>
`);
const kb = (f) => `${Math.round(fs.statSync(path.join(OUT, f)).size / 1024)} KB`;
console.log(`hosted build -> ${path.relative(FRONTEND, OUT)}: app.js ${kb("app.js")}, app.css ${kb("app.css")}, worker ${kb("pdf.worker.min.mjs")}`);
console.log("libraries:", Object.entries(useReal).map(([n, r]) => `${n}=${r ? "real" : "offline stand-in"}`).join(", "));
