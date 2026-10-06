/**
 * Browser entry point: mounts the app into the #root element and loads the global styles.
 * Layer: shared (app shell). Called by index.html. Calls app/App.tsx and styles/index.css.
 * Used by: every role, on every page load.
 */
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);

