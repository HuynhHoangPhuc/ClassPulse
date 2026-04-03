import { createRouter, createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./root-route";
import { loginRoute } from "./login-route";
import { authedLayout } from "./authed-layout";
import { dashboardRoute } from "./dashboard-route";
import { notificationsRoute } from "./placeholder-routes";
import {
  assessmentsListRoute,
  assessmentNewRoute,
  assessmentEditRoute,
  assessmentPreviewRoute,
  assessmentTakingRoute,
  assessmentResultsRoute,
  teacherSubmissionsRoute,
  teacherSubmissionDetailRoute,
} from "./assessment-routes";
import {
  classroomsListRoute,
  classroomDetailRoute,
} from "./classroom-routes";
import {
  questionsRoute,
  questionNewRoute,
  questionEditRoute,
} from "./questions-routes";
import { settingsRoute } from "./settings-route";

// ---------------------------------------------------------------------------
// Index redirect: / → /dashboard
// ---------------------------------------------------------------------------

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});

// ---------------------------------------------------------------------------
// Route tree
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  authedLayout.addChildren([
    dashboardRoute,
    questionsRoute,
    questionNewRoute,
    questionEditRoute,
    assessmentsListRoute,
    assessmentNewRoute,
    assessmentEditRoute,
    assessmentPreviewRoute,
    classroomsListRoute,
    classroomDetailRoute,
    notificationsRoute,
    assessmentTakingRoute,
    assessmentResultsRoute,
    teacherSubmissionsRoute,
    teacherSubmissionDetailRoute,
    settingsRoute,
  ]),
]);

// ---------------------------------------------------------------------------
// Router instance
// ---------------------------------------------------------------------------

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

// Type augmentation for useRouter / RouterProvider
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
