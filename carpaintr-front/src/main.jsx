import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import "rsuite/dist/rsuite.min.css";
import "../styles.less";
import "./theme-overrides.css";
import { CustomProvider } from "rsuite";

const fallbackEl = document.getElementById("fallback-refresh");
if (fallbackEl) {
  fallbackEl.remove();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("SW registered: ", registration);
      })
      .catch((registrationError) => {
        console.log("SW registration failed: ", registrationError);
      });
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CustomProvider>
      <App />
    </CustomProvider>
  </StrictMode>,
);
