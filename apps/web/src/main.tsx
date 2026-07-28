import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@/styles/globals.css";

function dismissBoot() {
  const boot = document.getElementById("boot");
  if (!boot) return;
  boot.classList.add("boot-out");
  boot.addEventListener("transitionend", () => boot.remove(), { once: true });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

requestAnimationFrame(dismissBoot);
