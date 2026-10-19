import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@vtubearea/ui/tokens.css";
import { AppShell } from "./app/app_shell";

const root_element = document.getElementById("root");
if (!root_element) throw new Error("Missing #root element");

createRoot(root_element).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
