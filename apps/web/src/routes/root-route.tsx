import { createRootRoute, Outlet } from "@tanstack/react-router";

/**
 * Root layout route — wraps the entire application tree.
 * All routes are children of this route.
 */
export const rootRoute = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return <Outlet />;
}
