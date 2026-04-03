# Phase 2 — Settings Page Route

## Priority: CRITICAL
## Status: Complete
## Effort: 1h

## Context

- `/settings` shows "Not Found" via both direct URL and client-side navigation
- Sidebar has Settings link for teachers (line 35 in sidebar.tsx)
- No route defined in `router.ts`
- No component exists

## Root Cause

Route simply not implemented. Sidebar links to `/settings` but no TanStack Router route or page component exists.

## Requirements

### Functional
- Settings page accessible at `/settings`
- Teacher-only page (sidebar only shows for teachers already)
- Minimal v1: profile display, theme preference, notification prefs placeholder
- Should match existing app design system

### Non-functional
- Must render within the authed layout (sidebar + header)

## Related Code Files

### Files to create:
- `apps/web/src/routes/settings-route.tsx` — Route definition + page component
- `apps/web/src/features/settings/settings-page.tsx` — Settings page UI (if >80 lines, extract from route)

### Files to modify:
- `apps/web/src/routes/router.ts` — Register settingsRoute in routeTree

### Files to read for context:
- `apps/web/src/routes/dashboard-route.tsx` — Pattern for route definition
- `apps/web/src/components/layout/sidebar.tsx` — Confirms `/settings` path

## Implementation Steps

### Step 1: Create settings route

**File:** `apps/web/src/routes/settings-route.tsx`

```typescript
import { createRoute } from "@tanstack/react-router";
import { authedLayout } from "./authed-layout";
import { SettingsPage } from "@/features/settings/settings-page";

export const settingsRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/settings",
  component: SettingsPage,
});
```

### Step 2: Create settings page component

**File:** `apps/web/src/features/settings/settings-page.tsx`

Sections:
1. **Profile** — Display name, email, role (from `useCurrentUser()`) — read-only from Clerk
2. **Appearance** — Theme toggle (reuse existing DarkModeToggle logic)
3. **Notifications** — Placeholder toggles for email/push preferences

Use `PageHeader`, `Card` components consistent with rest of app.

### Step 3: Register route in router.ts

**File:** `apps/web/src/routes/router.ts`

- Import `settingsRoute`
- Add to `authedLayout.addChildren([..., settingsRoute])`

## Todo List

- [x] Create `settings-route.tsx` with route definition
- [x] Create `features/settings/settings-page.tsx` with profile/appearance/notifications sections
- [x] Register route in `router.ts`
- [x] Verify client-side and direct URL navigation work

## Success Criteria

- `/settings` renders a styled page within the app shell
- Both sidebar click and direct URL work
- Page shows user profile info and theme preference
