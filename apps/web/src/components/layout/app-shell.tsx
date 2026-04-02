import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useCurrentUser } from "@/hooks/use-current-user";

interface AppShellProps {
  children: ReactNode;
}

/**
 * Main application shell: sidebar (collapsible) + header + scrollable content area.
 * Sidebar is always visible on md+ screens; toggled via header button on mobile.
 */
export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: user } = useCurrentUser();
  const role = (user?.role ?? "teacher") as "teacher" | "student" | "parent";

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      {/* Sidebar */}
      <Sidebar
        role={role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main column: header + content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={() => setMobileOpen((o) => !o)} />

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          <div
            className="mx-auto px-4 md:px-6 py-6"
            style={{ maxWidth: "var(--content-max-width)" }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
