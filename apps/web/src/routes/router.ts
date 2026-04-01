import { createRouter, createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./root-route";
import { loginRoute } from "./login-route";
import { authedLayout } from "./authed-layout";
import { dashboardRoute } from "./dashboard-route";
import {
  assessmentsRoute,
  classroomsRoute,
  notificationsRoute,
} from "./placeholder-routes";
import {
  questionsRoute,
  questionNewRoute,
  questionEditRoute,
} from "./questions-routes";

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
    assessmentsRoute,
    classroomsRoute,
    notificationsRoute,
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
