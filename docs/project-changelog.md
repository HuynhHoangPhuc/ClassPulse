# Project Changelog — Teaching Platform

All significant changes, features, and fixes are documented here.

---

## QA Bugfix Batch (Apr 3, 2026)

### Frontend Changes
- **FIXED:** `fetchApi()` in `lib/api-client.ts` — Retry on 401 with automatic token refresh, sanitized error messages to prevent token leakage
- **NEW:** Settings page (`/settings`) — Profile, appearance, and notifications preference sections
- **FIXED:** Assessment wizard and classroom creation forms — Show inline validation errors from server
- **FIXED:** Pluralization — Changed "1 members" to "1 member" in classroom views

### Backend Changes
- **NEW:** `GET /api/dashboard/stats` — Dashboard KPI endpoint returning student count, assessment count, avg score
- **UPDATED:** Error response format — Consistent error messages without sensitive data exposure

### Features
- Token refresh on 401 response (Clerk JWT expiration handling)
- Settings UI for profile management, theme preferences, notification toggles
- Real-time form validation feedback in wizards
- Dashboard stats endpoint for KPI cards

---

## Phase 7 - Real-time Notifications (Apr 2, 2026)

### Backend Changes
- **NEW:** `apps/api/src/durable-objects/notification-hub.ts` — WebSocket connection manager using Cloudflare Durable Objects
- **NEW:** `apps/api/src/routes/notification-routes.ts` — API endpoints for notification management (GET, PUT)
- **NEW:** `apps/api/src/routes/websocket-routes.ts` — WebSocket upgrade endpoint with JWT authentication
- **NEW:** `apps/api/src/services/realtime-service.ts` — Real-time event broadcasting to NotificationHub
- **UPDATED:** `apps/api/src/index.ts` — Register notification and websocket routes
- **UPDATED:** `apps/api/wrangler.toml` — Add NOTIFICATION_HUB Durable Object binding and migration tag

### Frontend Changes
- **NEW:** `apps/web/src/features/notifications/notification-provider.tsx` — Context provider + WebSocket connection management
- **NEW:** `apps/web/src/features/notifications/notification-bell.tsx` — Header bell icon with unread badge
- **NEW:** `apps/web/src/features/notifications/notification-panel.tsx` — Dropdown panel showing notifications
- **NEW:** `apps/web/src/features/notifications/notification-item.tsx` — Individual notification card
- **NEW:** `apps/web/src/features/notifications/notification-toast.tsx` — Toast for real-time events
- **NEW:** `apps/web/src/hooks/use-websocket.ts` — WebSocket hook with auto-reconnect and ping/pong keepalive
- **UPDATED:** `apps/web/src/components/layout/header.tsx` — Add notification bell component
- **UPDATED:** `apps/web/src/routes/authed-layout.tsx` — Wrap with NotificationProvider

### Configuration
- `apps/api/wrangler.toml`: Added `[durable_objects]` section with NotificationHub binding

### API Additions
- `GET /ws/classroom/:classroomId?token=<jwt>` — WebSocket upgrade to NotificationHub DO
- `GET /api/notifications` — List user's notifications
- `GET /api/notifications/unread-count` — Get unread notification count
- `PUT /api/notifications/:id` — Mark notification as read
- `PUT /api/notifications/read-all` — Mark all notifications as read

### Architecture
- Per-classroom WebSocket connection management via Durable Objects
- Real-time event broadcasting to classroom members
- Client-side auto-reconnect with exponential backoff (1s → 2s → 4s → ... → 30s max)
- Ping/pong keepalive every 30 seconds to prevent connection timeout
- Hybrid approach: WebSocket for real-time + REST API for history/read tracking

---

## Phase 5 - Assessment Taking (Apr 2, 2026)

### Backend Changes
- **NEW:** Assessment attempt system with start/save/submit/results/detail endpoints
- **NEW:** Score calculation with custom per-question scores and penalties
- **NEW:** Tab-switch detection for anti-cheat functionality
- **UPDATED:** Database schema with assessmentAttempts and attemptAnswers tables
- **UPDATED:** Database schema with tab_switch_count and question_order columns

### Frontend Changes
- **NEW:** Assessment taking interface with full-screen layout
- **NEW:** Countdown timer with grace period handling
- **NEW:** Question grid for navigation
- **NEW:** Results page with explanations
- **NEW:** Teacher submission viewer with tab-switch counts

### Features
- Timed assessment with server-validated timer
- Seeded randomization for reproducible question/option order
- Auto-save progress during attempt
- Atomic submission guard (prevents resubmit)
- Immediate result display (if configured)

---

## Phase 4 - Classroom (Apr 1, 2026)

### Backend Changes
- **NEW:** Classroom CRUD API (create, list, read, update, delete, regenerate-code)
- **NEW:** Classroom member management (add, list, remove, update role)
- **NEW:** Post/feed system for announcements and assignments
- **NEW:** Comment system with threading support
- **NEW:** @mention support with mention extraction and tracking
- **NEW:** Member search endpoint for autocomplete

### Frontend Changes
- **NEW:** Classroom list and detail pages
- **NEW:** 4-tab layout: Feed, Members, Assessments, Settings
- **NEW:** Post composer with markdown support
- **NEW:** Comment section with threading
- **NEW:** @mention autocomplete dropdown
- **NEW:** Member management dialog

### Features
- Invite codes for classroom joining
- Role-based access (teacher, student, parent)
- Rich feed with announcements and assignments
- Threaded discussions with mention notifications
- Classroom settings management

---

## Phase 3 - Assessment Bank (Apr 1, 2026)

### Backend Changes
- **NEW:** Assessment CRUD API with filtering and pagination
- **NEW:** Assessment auto-generation API with AI config
- **NEW:** Assessment duplication/cloning
- **UPDATED:** Assessment preview endpoint

### Frontend Changes
- **NEW:** 3-step assessment creation wizard
- **NEW:** Question picker with advanced search and filters
- **NEW:** Auto-generation configuration UI
- **NEW:** Assessment list page with sorting and pagination

### Features
- Manual assessment creation by selecting questions
- Auto-generation with topic/distribution configuration
- Assessment preview before assignment
- Assessment duplication for templates
- Full assessment lifecycle management

---

## Phase 2 - Question Bank (Apr 1, 2026)

### Backend Changes
- **NEW:** Question CRUD API (GET/POST/PUT/DELETE /api/questions)
- **NEW:** Tag management API (GET/POST/PUT/DELETE /api/tags)
- **NEW:** Bulk question import API (POST /api/questions/bulk)
- **NEW:** Image upload endpoint (POST /api/upload/image)
- **UPDATED:** Database schema with tags and questionTags tables

### Frontend Changes
- **NEW:** Question list page with filters, search, pagination
- **NEW:** Question editor with markdown + math/code support
- **NEW:** Tag management UI
- **NEW:** Bulk import dialog

### Features
- Teacher-created tag system with colors
- Markdown editor with live preview
- LaTeX math support (inline and block)
- Code syntax highlighting
- Image embedding in questions
- Question filtering by tags, complexity, search term
- Bulk import from CSV or JSON

---

## Phase 1 - Foundation (Mar 2026)

### Backend
- **NEW:** Hono API on Cloudflare Workers
- **NEW:** Drizzle ORM with SQLite database
- **NEW:** Database schema (15 tables: users, tags, questions, assessments, classrooms, etc.)
- **NEW:** Clerk JWT authentication + webhook sync
- **NEW:** Middleware (auth, CORS, error handling)

### Frontend
- **NEW:** React 19 + Vite build setup
- **NEW:** TanStack Router with code-based routes
- **NEW:** TanStack Query for server state management
- **NEW:** Tailwind CSS v4 styling
- **NEW:** Dark mode support
- **NEW:** Layout components (app-shell, sidebar, header)
- **NEW:** Reusable UI components (card, badge, page-header, empty-state)

### Shared Package
- **NEW:** TypeScript types for all entities
- **NEW:** Zod validation schemas
- **NEW:** Constants (roles, complexity levels, assessment types)

### Infrastructure
- **NEW:** Turborepo monorepo setup
- **NEW:** pnpm workspaces configuration
- **NEW:** TypeScript strict mode
- **NEW:** ESLint configuration

---

## Version History

| Version | Phase | Date | Status |
|---------|-------|------|--------|
| 1.5.1 | QA Bugfix | Apr 3, 2026 | Current (JWT refresh, Settings, Form validation) |
| 1.5 | Phase 7 | Apr 2, 2026 | Completed (Real-time Notifications) |
| 1.4 | Phase 5 | Apr 2, 2026 | Completed (Assessment Taking) |
| 1.3 | Phase 4 | Apr 1, 2026 | Completed (Classroom) |
| 1.2 | Phase 3 | Apr 1, 2026 | Completed (Assessment Bank) |
| 1.1 | Phase 2 | Apr 1, 2026 | Completed (Question Bank) |
| 1.0 | Phase 1 | Mar 2026 | Completed (Foundation) |

---

## Breaking Changes

None documented yet.

---

## Deprecations

None documented yet.

---

## Security Updates

### Phase 7 (Apr 2, 2026)
- WebSocket authentication via JWT query parameter (browsers cannot send headers)
- Classroom membership verification before allowing WebSocket connection
- User isolation per classroom via Durable Object bindings

### Phase 1 (Mar 2026)
- Clerk JWT validation on all protected routes
- Webhook signature verification for user sync
- Role-based access control (RBAC) checks in route handlers
