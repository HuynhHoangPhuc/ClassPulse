import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Persists dark mode preference in localStorage.
 * Falls back to OS prefers-color-scheme on first visit.
 * Toggles the `.dark` class on <html>.
 */
function getInitialDark(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("theme");
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function DarkModeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean>(getInitialDark);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark((d) => !d)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex items-center justify-center w-9 h-9 rounded-xl transition-colors",
        "hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
        className
      )}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
