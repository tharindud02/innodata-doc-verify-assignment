import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { registerAuthSession } from "@/lib/auth-session";
import { useAuth } from "@/hooks/useAuth";

registerAuthSession({
  getToken: () => useAuth.getState().token,
  clearSession: () => useAuth.getState().logout(),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);