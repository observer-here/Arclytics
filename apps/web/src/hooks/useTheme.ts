import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "arclytics.theme";

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : "system";
  } catch {
    return "light";
  }
}

export function resolvedDark(theme: Theme) {
  return theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", resolvedDark(theme));
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);

  function setTheme(next: Theme) {
    localStorage.setItem(KEY, next);
    setThemeState(next);
    applyTheme(next);
  }

  return { theme, dark: resolvedDark(theme), setTheme };
}
