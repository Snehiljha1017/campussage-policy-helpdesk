import { ComponentType, useEffect } from "react";
import { Link, useLocation } from "./router";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Library from "./pages/Library";
import PromptLab from "./pages/PromptLab";
import Evaluation from "./pages/Evaluation";
import About from "./pages/About";

const ROUTES: Record<string, { el: ComponentType; title: string }> = {
  "/": { el: Landing, title: "CampusSage - University Policy Helpdesk" },
  "/dashboard": { el: Dashboard, title: "Dashboard · CampusSage" },
  "/chat": { el: Chat, title: "Ask CampusSage" },
  "/library": { el: Library, title: "Policy Library · CampusSage" },
  "/lab": { el: PromptLab, title: "Prompt Lab · CampusSage" },
  "/evaluation": { el: Evaluation, title: "Evaluation · CampusSage" },
  "/about": { el: About, title: "About · CampusSage" },
};

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="font-serif text-6xl text-navy-900">404</p>
        <p className="mt-2 text-slate-600">This page isn't in any policy document.</p>
        <Link to="/" className="btn-primary mt-6">Back to home</Link>
      </div>
    </div>
  );
}

export default function App() {
  const { path } = useLocation();
  const route = ROUTES[path.replace(/\/$/, "") || "/"];
  useEffect(() => {
    document.title = route?.title ?? "Not found · CampusSage";
  }, [route]);
  const Page = route?.el ?? NotFound;
  return <Page />;
}
