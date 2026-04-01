# Phase 7: Real-time Notifications

## Context

- [Phase 6 Comments & Mentions](./phase-06-comments-mentions.md) — notification records in DB
- [Design Guidelines §6.8](../../docs/design-guidelines.md) — Notification Panel design
- [Brainstorm — Real-time Architecture](../reports/brainstorm-260401-1835-teaching-platform.md)

## Overview

- **Priority**: P2
- **Status**: Pending
- **Effort**: 8h
- **Depends On**: Phase 6
- **Description**: Durable Objects WebSocket setup for real-time notification delivery, notification inbox with read/unread, notification panel UI. Upgrades Phase 6's DB-only notifications to live push.

## Key Insights

- Durable Object per classroom (NotificationHub) manages WebSocket connections
- Client connects to classroom-specific DO on entering classroom
- API triggers DO notification when events occur (comment, mention, assignment)
- Offline users: notification already in DB (Phase 6), DO push is enhancement
- Free tier: 100K DO requests/day — sufficient for small scale
- User may be in multiple classrooms → multiple DO connections

## Requirements

### Functional
- WebSocket connection per classroom (auto-connect on classroom view)
- Real-time push for: new comment, mention, assessment assignment, announcement
- Notification bell icon in header with unread count badge
- Notification panel (slide-out): grouped by time, read/unread, click to navigate
- Mark as read (individual + mark all)
- Notification API for historical notifications (paginated)

### Non-Functional
- Notification delivered within 2 seconds of event
- WebSocket reconnects automatically on disconnect
- Graceful degradation: if DO unavailable, polling fallback (every 30s)
- Unread count updates in real-time

## Architecture

### Durable Object: NotificationHub

```typescript
// One DO per classroom
export class NotificationHub implements DurableObject {
  sessions: Map<string, WebSocket>  // userId → WebSocket
  
  async fetch(request: Request) {
    // Handle WebSocket upgrade
    // On connect: add to sessions map
    // On message: handle ping/pong
    // On close: remove from sessions
  }
  
  async broadcast(event: NotificationEvent) {
    // Called by Worker API via DO stub
    // Send event to all connected sessions
    // Skip sender (userId in event)
  }
}
```

### Event Flow

```
Comment Created (Worker API)
  ↓
Create notification records in D1 (Phase 6)
  ↓
Get classroom DO stub
  ↓
DO.broadcast({ type: 'comment.new', data: {...}, recipients: [...] })
  ↓
DO sends to connected WebSocket clients
  ↓
React SPA receives → update notification count + show toast
```

### Client WebSocket Manager

```
On enter classroom view:
  ws = new WebSocket(`/api/ws/classroom/${classroomId}`)
  
On message:
  Parse event type
  Update TanStack Query cache (invalidate affected queries)
  Increment notification count
  Show toast notification
  
On close/error:
  Exponential backoff reconnect (1s, 2s, 4s, max 30s)
  
On leave classroom:
  ws.close()
```

## Related Code Files

### Files to Create
- `apps/api/src/durable-objects/notification-hub.ts` — DO class
- `apps/api/src/routes/websocket-routes.ts` — WebSocket upgrade endpoint
- `apps/api/src/routes/notification-routes.ts` — Notification CRUD
- `apps/api/src/services/realtime-service.ts` — Trigger DO broadcasts
- `apps/web/src/features/notifications/` — Notification feature module
  - `notification-provider.tsx` — WebSocket connection manager (React context)
  - `notification-bell.tsx` — Bell icon with unread count badge
  - `notification-panel.tsx` — Slide-out panel
  - `notification-item.tsx` — Single notification row
  - `notification-toast.tsx` — In-app toast for new events
- `apps/web/src/hooks/use-websocket.ts` — WebSocket hook with reconnect
- `packages/shared/src/types/notification-types.ts` — Event type definitions

### Files to Modify
- `apps/api/src/index.ts` — Add WebSocket route, export DO class
- `apps/api/wrangler.toml` — DO binding already configured in Phase 1
- `apps/api/src/services/comment-service.ts` — Trigger real-time after comment create
- `apps/api/src/services/classroom-service.ts` — Trigger on assessment assignment
- `apps/web/src/components/layout/header.tsx` — Add notification bell
- `apps/web/src/routes/_authed.tsx` — Wrap with NotificationProvider

## Implementation Steps

### 1. Durable Object (2h)

1. Create `NotificationHub` class:
   - `sessions: Map<string, WebSocket>` tracking connected users
   - `fetch`: handle WebSocket upgrade, authenticate via Clerk token in URL params
   - `webSocketMessage`: handle ping/pong keepalive
   - `webSocketClose`: cleanup session
   - `broadcast(event)`: send to all connected clients (filter by recipients if provided)
2. Export DO class in `index.ts`, verify wrangler.toml bindings
3. Create WebSocket upgrade endpoint in Hono:
   ```
   GET /api/ws/classroom/:classroomId → upgrade to WebSocket via DO
   ```
   Validate: user is classroom member, extract Clerk session

### 2. Real-time Service (1.5h)

1. Create `realtime-service.ts`:
   ```typescript
   async function notifyClassroom(env: Env, classroomId: string, event: NotificationEvent) {
     const id = env.NOTIFICATION_HUB.idFromName(classroomId)
     const stub = env.NOTIFICATION_HUB.get(id)
     await stub.fetch('https://internal/broadcast', {
       method: 'POST',
       body: JSON.stringify(event)
     })
   }
   ```
2. Integrate into existing services:
   - `comment-service.ts`: after create comment → `notifyClassroom('comment.new', ...)`
   - `classroom-service.ts`: after post creation → `notifyClassroom('announcement.new' | 'assessment.assigned', ...)`

### 3. Notification API (1.5h)

1. `GET /api/notifications` — paginated list for current user, sorted by created_at desc
2. `PUT /api/notifications/:id/read` — mark single as read
3. `PUT /api/notifications/read-all` — mark all as read
4. `GET /api/notifications/unread-count` — count of unread notifications

### 4. Client WebSocket Manager (1.5h)

1. `NotificationProvider` (React context):
   - Manages WebSocket connections per classroom
   - On mount: connect to active classroom's DO
   - On event: dispatch to handlers
   - Reconnect with exponential backoff
2. `useWebSocket` hook: connect, send, receive, connection state
3. On notification event:
   - Invalidate relevant TanStack Query keys (comments, feed)
   - Increment unread count in notification state
   - Show toast notification (auto-dismiss 5s)

### 5. Notification UI (1.5h)

1. **Notification bell**: Lucide `bell` icon in header, badge with unread count (red dot if > 0)
2. **Notification panel**: slide-out from right on bell click
   - Glass card background (per design guidelines)
   - Header: "Notifications" + "Mark all read" button
   - Grouped: Today, This Week, Earlier
   - Each item: icon (type-specific), actor avatar, message, relative timestamp
   - Unread: left accent border + bold text
   - Click: navigate to source (post, comment, assessment)
3. **Toast**: appears top-right on new event, auto-dismiss 5s

## Todo

- [ ] Create NotificationHub Durable Object class
- [ ] Create WebSocket upgrade endpoint in Hono
- [ ] Implement broadcast method in DO
- [ ] Create realtime-service.ts for triggering DO events
- [ ] Integrate real-time triggers into comment and post services
- [ ] Create notification CRUD API (list, mark read, unread count)
- [ ] Build NotificationProvider (React context + WebSocket manager)
- [ ] Build useWebSocket hook with reconnect logic
- [ ] Build notification bell with unread badge
- [ ] Build notification panel (slide-out, grouped)
- [ ] Build notification toast component
- [ ] Test WebSocket connection/reconnection
- [ ] Test end-to-end: comment → DO broadcast → client notification
- [ ] Add polling fallback (30s) if WebSocket unavailable

## Success Criteria

- WebSocket connects to classroom DO on entering classroom
- New comment triggers real-time notification to other members
- @mention pushes notification within 2 seconds
- Notification bell shows unread count
- Panel shows grouped notifications with read/unread states
- Mark as read works (individual + all)
- Reconnects automatically after disconnect
- Graceful degradation to polling if DO unavailable

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Durable Object cold start latency | Medium | Keep connections alive with ping/pong (30s interval) |
| 100K DO requests/day limit | Medium | One connection per classroom (not per event); batch if needed |
| WebSocket disconnect on mobile sleep | Low | Auto-reconnect with backoff; DB notifications as fallback |
| Auth token expiry on long WebSocket | Low | Reconnect with fresh token on auth error |

## Security

- WebSocket upgrade validates Clerk token
- DO verifies user is classroom member before accepting connection
- Broadcast filters recipients (don't leak to non-members)
- No sensitive data in WebSocket messages (just notification metadata, fetch full data via API)
