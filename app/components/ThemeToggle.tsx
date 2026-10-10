"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { THEME_KEY as KEY } from "@/lib/theme";

type Theme = "light" | "dark";

/**
 * Light/dark switch. The choice is remembered per browser; the first visit follows the device setting.
 * The change cross-fades: a View Transition where the browser supports it, otherwise eased colour
 * transitions. People who ask their device to reduce motion get an instant switch.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  const flip = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = next;
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // private mode or blocked storage: the switch still works for this visit
      }
      flushSync(() => setTheme(next));
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();

    if ("startViewTransition" in document) {
      root.classList.add("theme-switching");
      const t = document.startViewTransition(apply);
      t.finished.finally(() => root.classList.remove("theme-switching"));
      return;
    }

    // Fallback: let every colour ease for the length of the switch.
    root.classList.add("theme-fading");
    apply();
    window.setTimeout(() => root.classList.remove("theme-fading"), 500);
  };

  const dark = theme === "dark";
  return (
    <button type="button" className="theme-toggle" onClick={flip} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
      {dark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
        </svg>
      )}
      {theme === null ? "Theme" : dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
