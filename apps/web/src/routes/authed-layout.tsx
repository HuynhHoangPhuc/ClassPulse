import { createRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { rootRoute } from "./root-route";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationProvider } from "@/features/notifications/notification-provider";
import { NotificationToast } from "@/features/notifications/notification-toast";

/**
 * Auth guard layout route.
 * All protected routes nest under this route.
 * Redirects unauthenticated users to /login.
 */
export const authedLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authed",
  component: AuthedLayoutComponent,
});

function AuthedLayoutComponent() {
  const { isSignedIn, isLoaded } = useAuth();

  // Wait for Clerk to initialize before making auth decisions
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    // Imperatively redirect — beforeLoad cannot use hooks so we do it here
    window.location.replace("/login");
    return null;
  }

  return (
    <NotificationProvider>
      <AppShell>
        <Outlet />
      </AppShell>
      <NotificationToast />
    </NotificationProvider>
  );
}
