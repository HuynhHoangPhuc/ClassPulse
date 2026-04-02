import { createRoute } from "@tanstack/react-router";
import { authedLayout } from "./authed-layout";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Bell } from "lucide-react";

// ---------------------------------------------------------------------------
// Notifications — Phase 7
// ---------------------------------------------------------------------------

export const notificationsRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/notifications",
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Your activity feed" />
      <EmptyState
        icon={<Bell size={40} />}
        headline="Notifications coming in Phase 7"
        description="Stay updated on student submissions, results, and messages."
      />
    </div>
  ),
});
