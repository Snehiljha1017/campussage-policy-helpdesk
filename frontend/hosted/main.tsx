// Entry point of the hosted single-page build (see hosted/README.md).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../src/App";
import { scrollToInitialAnchor } from "./router";
import "../src/index.css";

// The artifact sandbox ignores window.confirm; this build keeps everything in the
// viewer's own browser (samples can be reloaded), so destructive actions proceed.
window.confirm = () => true;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
scrollToInitialAnchor();
