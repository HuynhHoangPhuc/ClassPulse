import { createRoute } from "@tanstack/react-router";
import { authedLayout } from "./authed-layout";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen, ClipboardList, Users, Bell } from "lucide-react";

// ---------------------------------------------------------------------------
// Questions — Phase 2
// ---------------------------------------------------------------------------

export const questionsRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/questions",
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Questions" description="Question bank management" />
      <EmptyState
        icon={<BookOpen size={40} />}
        headline="Questions coming in Phase 2"
        description="Build, tag, and manage your reusable question library here."
      />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Assessments — Phase 3
// ---------------------------------------------------------------------------

export const assessmentsRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/assessments",
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Assessments" description="Create and manage assessments" />
      <EmptyState
        icon={<ClipboardList size={40} />}
        headline="Assessments coming in Phase 3"
        description="Design timed assessments and track student results."
      />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Classrooms — Phase 4
// ---------------------------------------------------------------------------

export const classroomsRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/classrooms",
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Classrooms" description="Manage your classrooms and students" />
      <EmptyState
        icon={<Users size={40} />}
        headline="Classrooms coming in Phase 4"
        description="Organise students into classrooms and assign assessments."
      />
    </div>
  ),
});

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
