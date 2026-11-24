// Offline stand-in for lucide-react used only by the hosted single-page build
// (the artifact sandbox cannot load npm packages). Same component API: size, className.
// The normal Vite build uses the real lucide-react package.
import { createElement as h, type ReactNode } from "react";

type P = { size?: number; className?: string; strokeWidth?: number };
const D: Record<string, string> = {
  AlertTriangle: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z|M12 9v4|M12 17h.01",
  ArrowRight: "M5 12h14|m12 5 7 7-7 7",
  ArrowUp: "m5 12 7-7 7 7|M12 19V5",
  BadgeCheck: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z|m9 12 2 2 4-4",
  BarChart3: "M3 3v18h18|M18 17V9|M13 17V5|M8 17v-3",
  Beaker: "M4.5 3h15|M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3|M6 14h12",
  BookOpen: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z|M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  BookOpenCheck: "M8 3H2v15h7a3 3 0 0 1 3 3V7a4 4 0 0 0-4-4z|m16 12 2 2 4-4|M22 6V3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7v-2.3",
  Building2: "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z|M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2|M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2|M10 6h4|M10 10h4|M10 14h4|M10 18h4",
  CalendarClock: "M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5|M16 2v4|M8 2v4|M3 10h5|M17.5 17.5 16 16.3V14|C16 16 6",
  Check: "M20 6 9 17l-5-5",
  CheckCircle2: "C12 12 10|m9 12 2 2 4-4",
  ChevronDown: "m6 9 6 6 6-6",
  CircleHelp: "C12 12 10|M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3|M12 17h.01",
  ClipboardList: "M8 2h8v4H8z|M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2|M12 11h4|M12 16h4|M8 11h.01|M8 16h.01",
  Copy: "M8 8h14v14H8z|M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
  Cpu: "M4 4h16v16H4z|M9 9h6v6H9z|M15 2v2|M15 20v2|M2 15h2|M2 9h2|M20 15h2|M20 9h2|M9 2v2|M9 20v2",
  Database: "E12 5 9 3|M3 5v14a9 3 0 0 0 18 0V5|M3 12a9 3 0 0 0 18 0",
  Download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|m7 10 5 5 5-5|M12 15V3",
  Eraser: "m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21|M22 21H7|m5 11 9 9",
  Eye: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z|C12 12 3",
  FileCode2: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4|M14 2v4a2 2 0 0 0 2 2h4|m5 12-3 3 3 3|m9 18 3-3-3-3",
  FileSearch: "M14 2v4a2 2 0 0 0 2 2h4|M4.3 21.7A2 2 0 0 0 6 22h12a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3|m9 18-1.5-1.5|C5 14 3",
  FileText: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z|M14 2v4a2 2 0 0 0 2 2h4|M10 9H8|M16 13H8|M16 17H8",
  FileUp: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z|M14 2v4a2 2 0 0 0 2 2h4|M12 12v6|m15 15-3-3-3 3",
  FlaskConical: "M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2|M8.5 2h7|M7 16h10",
  GraduationCap: "M22 10 12 5 2 10l10 5 10-5Z|M6 12v5c3 3 9 3 12 0v-5|M22 10v6",
  History: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8|M3 3v5h5|M12 7v5l4 2",
  Home: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M9 22V12h6v10",
  Info: "C12 12 10|M12 16v-4|M12 8h.01",
  Landmark: "M3 22h18|M6 18v-7|M10 18v-7|M14 18v-7|M18 18v-7|M12 2l8 5H4z",
  Languages: "m5 8 6 6|m4 14 6-6 2-3|M2 5h12|M7 2h1|m22 22-5-10-5 10|M14 18h6",
  Layers: "m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z|m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65|m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65",
  LayoutDashboard: "M3 3h7v9H3z|M14 3h7v5h-7z|M14 12h7v9h-7z|M3 16h7v5H3z",
  ListChecks: "m3 17 2 2 4-4|m3 7 2 2 4-4|M13 6h8|M13 12h8|M13 18h8",
  Loader2: "M21 12a9 9 0 1 1-6.219-8.56",
  Lock: "M5 11h14v11H5z|M7 11V7a5 5 0 0 1 10 0v4",
  Menu: "M4 12h16|M4 6h16|M4 18h16",
  MessageSquareText: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z|M13 8H7|M17 12H7",
  Play: "m6 3 14 9-14 9z",
  Quote: "M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z|M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
  RefreshCw: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8|M21 3v5h-5|M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16|M8 16H3v5",
  Rocket: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z|m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z|M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0|M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
  Save: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z|M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7|M7 3v4a1 1 0 0 0 1 1h7",
  ScrollText: "M15 12h-5|M15 8h-5|M19 17V5a2 2 0 0 0-2-2H4|M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3",
  Search: "C11 11 8|m21 21-4.3-4.3",
  ShieldAlert: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z|M12 8v4|M12 16h.01",
  ShieldCheck: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z|m9 12 2 2 4-4",
  ShieldQuestion: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z|M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3|M12 17h.01",
  Sparkles: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z|M20 3v4|M22 5h-4",
  Target: "C12 12 10|C12 12 6|C12 12 2",
  ThumbsDown: "M17 14V2|M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z",
  ThumbsUp: "M7 10v12|M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",
  Trash2: "M3 6h18|M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6|M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2|M10 11v6|M14 11v6",
  UploadCloud: "M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2|M12 12v9|m16 16-4-4-4 4",
  Users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|C9 7 4|M22 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75",
  Wallet: "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1|M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
  X: "M18 6 6 18|m6 6 12 12",
  XCircle: "C12 12 10|m15 9-6 6|m9 9 6 6",
};

function parts(spec: string): ReactNode[] {
  return spec.split("|").map((s, i) => {
    if (s.startsWith("C")) { const [cx, cy, r] = s.slice(1).trim().split(/\s+/).map(Number); return h("circle", { key: i, cx, cy, r }); }
    if (s.startsWith("E")) { const [cx, cy, rx, ry] = s.slice(1).trim().split(/\s+/).map(Number); return h("ellipse", { key: i, cx, cy, rx, ry }); }
    return h("path", { key: i, d: s });
  });
}

const make = (name: string) => {
  const Icon = ({ size = 24, className, strokeWidth = 2 }: P) =>
    h("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
      strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", className, "aria-hidden": true }, ...parts(D[name] ?? "C12 12 9"));
  Icon.displayName = name;
  return Icon;
};

export const AlertTriangle = make("AlertTriangle"), ArrowRight = make("ArrowRight"), ArrowUp = make("ArrowUp"), BadgeCheck = make("BadgeCheck"),
  BarChart3 = make("BarChart3"), Beaker = make("Beaker"), BookOpen = make("BookOpen"), BookOpenCheck = make("BookOpenCheck"), Building2 = make("Building2"),
  CalendarClock = make("CalendarClock"), Check = make("Check"), CheckCircle2 = make("CheckCircle2"), ChevronDown = make("ChevronDown"),
  CircleHelp = make("CircleHelp"), ClipboardList = make("ClipboardList"), Copy = make("Copy"), Cpu = make("Cpu"), Database = make("Database"),
  Download = make("Download"), Eraser = make("Eraser"), Eye = make("Eye"), FileCode2 = make("FileCode2"), FileSearch = make("FileSearch"),
  FileText = make("FileText"), FileUp = make("FileUp"), FlaskConical = make("FlaskConical"), GraduationCap = make("GraduationCap"), History = make("History"),
  Home = make("Home"), Info = make("Info"), Landmark = make("Landmark"), Languages = make("Languages"), Layers = make("Layers"),
  LayoutDashboard = make("LayoutDashboard"), ListChecks = make("ListChecks"), Loader2 = make("Loader2"), Lock = make("Lock"), Menu = make("Menu"),
  MessageSquareText = make("MessageSquareText"), Play = make("Play"), Quote = make("Quote"), RefreshCw = make("RefreshCw"), Rocket = make("Rocket"),
  Save = make("Save"), ScrollText = make("ScrollText"), Search = make("Search"), ShieldAlert = make("ShieldAlert"), ShieldCheck = make("ShieldCheck"),
  ShieldQuestion = make("ShieldQuestion"), Sparkles = make("Sparkles"), Target = make("Target"), ThumbsDown = make("ThumbsDown"), ThumbsUp = make("ThumbsUp"),
  Trash2 = make("Trash2"), UploadCloud = make("UploadCloud"), Users = make("Users"), Wallet = make("Wallet"), X = make("X"), XCircle = make("XCircle");
