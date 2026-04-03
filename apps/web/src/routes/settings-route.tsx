import { createRoute } from "@tanstack/react-router";
import { authedLayout } from "./authed-layout";
import { SettingsPage } from "@/features/settings/settings-page";

export const settingsRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/settings",
  component: SettingsPage,
});
