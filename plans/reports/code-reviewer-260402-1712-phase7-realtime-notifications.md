# Code Review: Phase 7 - Real-time Notifications

## Scope
- **Files**: 16 (10 new, 6 modified)
- **Focus**: WebSocket lifecycle, DO security, notification access control, frontend state management
- **Backend**: Durable Object hub, WS upgrade route, notification CRUD, realtime service
- **Frontend**: WS hook, notification provider/bell/panel/item/toast, layout integration

## Overall Assessment

Solid implementation. Clean separation between DO broadcast, notification persistence, and frontend state. Several **critical and high-priority issues** found, primarily around security (WS auth bypass at DO level, missing notification DB writes on broadcast) and WebSocket lifecycle (stale closure, reconnect without auth token).

---

## Critical Issues

### C1. WebSocket upgrade to DO has no auth token -- anyone with userId can connect

**File**: `durable-objects/notification-hub.ts:36`  
**Problem**: The DO accepts connections based solely on a `userId` query param. The Worker route (`websocket-routes.ts:24`) checks membership, but the DO itself is addressable by any Worker or internal call. More importantly, the Worker forwards the upgrade request **without a Clerk Bearer token** in the WS handshake -- WebSocket upgrade requests from browsers don't carry `Authorization` headers automatically.

The auth middleware (`authMiddleware`) checks `Authorization: Bearer ...`, but **browsers cannot set custom headers on WebSocket connections**. The `new WebSocket(url)` call in `use-websocket.ts:25` sends no auth header. The `/api/ws/*` route goes through `app.use("/api/*", authMiddleware)` which will **reject the WS upgrade with 401** because there's no Bearer token.

**Impact**: WebSocket connections will fail for all users in production.  
**Fix**: Either:
1. Pass the Clerk token as a query param (`?token=...`) and verify it in the WS route before the auth middleware, OR
2. Create a short-lived WS ticket via a REST endpoint, then pass the ticket as a query param

```ts
// Option 1: websocket-routes.ts - extract token from query param
websocketRoutes.get("/ws/classroom/:classroomId", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Missing token" }, 401);
  const payload = await verifyToken(token, { secretKey: c.env.CLERK_SECRET_KEY });
  if (!payload?.sub) return c.json({ error: "Invalid token" }, 401);
  // ... use payload.sub as userId instead of c.get("userId")
});
```
And exclude `/api/ws/*` from the global auth middleware, or register WS routes outside `/api/*`.

### C2. No notification DB records created on broadcast

**File**: `comment-routes.ts:77`, `classroom-post-routes.ts:127`  
**Problem**: The code calls `notifyClassroom()` to broadcast via DO, but **never inserts rows into the `notifications` table**. The comment at line 4 of `realtime-service.ts` says "Called after DB notification records are created (Phase 6)" but no insertion happens. The notification panel fetches from the `notifications` table -- it will always be empty.

**Impact**: Notification panel shows "No notifications yet" forever. Unread count always 0 from API. Only toast (from WS) works, and only while connected.  
**Fix**: Before calling `notifyClassroom()`, insert notification records for each recipient:

```ts
// In comment-routes.ts after creating comment:
const members = await getClassroomMemberIds(db, post.classroomId);
const recipientIds = members.filter(id => id !== userId);
await insertNotifications(db, recipientIds, {
  type: "comment_new",
  referenceType: "comment",
  referenceId: commentId,
  message: `New comment on "${post.title}"`,
});
```

### C3. DO broadcast endpoint has no authentication

**File**: `notification-hub.ts:23-27`  
**Problem**: The `/broadcast` endpoint on the DO accepts any POST request without verifying it came from the Worker. While DOs are not directly addressable from the internet, if the Worker has any SSRF-like vulnerability or if routing is misconfigured, anyone could broadcast arbitrary messages to all connected users.

**Impact**: Medium-risk -- depends on attack surface. Cloudflare DOs are only reachable via `stub.fetch()` from the same Worker, so this is defense-in-depth.  
**Fix**: Add a shared secret header check:
```ts
if (request.headers.get("X-Internal-Key") !== "expected-secret") {
  return new Response("Forbidden", { status: 403 });
}
```

---

## High Priority

### H1. `onMessage` callback causes infinite reconnect loop via stale closure

**File**: `use-websocket.ts:54`  
**Problem**: `onMessage` is in the dependency array of `useCallback` for `connect`. In `notification-provider.tsx:58`, `handleMessage` depends on `queryClient` (stable) but the function reference itself will be recreated on every render unless memoized. Each new `handleMessage` reference triggers `connect` to be recreated, which triggers the `useEffect` cleanup + reconnect cycle.

Actually -- `handleMessage` IS wrapped in `useCallback` with `[queryClient]` dependency, which is stable from `useQueryClient()`. So this is **not a bug in the current code**, but it's fragile. If anyone adds state to `handleMessage`'s deps, it will cause reconnect storms.

**Recommendation**: Use a ref for the message handler to decouple it from the WS lifecycle:
```ts
const onMessageRef = useRef(onMessage);
onMessageRef.current = onMessage;
// In connect(): ws.onmessage = (e) => onMessageRef.current?.(e);
```
Remove `onMessage` from `connect`'s dependency array.

### H2. Unread count optimistic increment without DB truth

**File**: `notification-provider.tsx:62`  
**Problem**: `setUnreadCount((c) => c + 1)` on every WS message, but since no DB records are created (C2), the API always returns 0. On page refresh, count resets to 0. Even after C2 is fixed, the client count can drift from DB if messages are lost or duplicated.

**Fix**: After fixing C2, call `refreshCount()` after receiving a WS message (debounced) rather than optimistically incrementing.

### H3. WebSocket URL has no auth token

**File**: `notification-provider.tsx:55`  
**Problem**: Related to C1. The WS URL is built as `ws://host/api/ws/classroom/{id}` with no token. Needs the Clerk token appended as query param.

**Fix**: 
```ts
useEffect(() => {
  if (!activeClassroom) { setWsUrl(""); return; }
  getToken().then(token => {
    const wsBase = API_URL.replace(/^http/, "ws");
    setWsUrl(`${wsBase}/api/ws/classroom/${activeClassroom}?token=${token}`);
  });
}, [activeClassroom, getToken]);
```
Note: Clerk tokens expire (~60s default), so token refresh during long-lived WS connections needs consideration. Reconnect on token refresh.

### H4. No `createdAt` index for cursor-based pagination

**File**: `notification-routes.ts:19`  
**Problem**: Query uses `WHERE created_at < ? ORDER BY created_at DESC`. The schema only has an index on `user_id`. For users with many notifications, this will be a full table scan filtered by userId, then sorted.

**Fix**: Add composite index:
```ts
(t) => ({
  userIdx: index("notifications_user_id_idx").on(t.userId),
  userCreatedIdx: index("notifications_user_created_idx").on(t.userId, t.createdAt),
})
```

---

## Medium Priority

### M1. Single-classroom WS limitation

**File**: `notification-provider.tsx:44`  
**Problem**: Only one `activeClassroom` at a time. If user navigates between classrooms, the previous WS disconnects. Notifications from other classrooms won't arrive via WS. This is a known design tradeoff but worth documenting.

### M2. `handleMarkRead` / `handleMarkAllRead` have no error handling

**File**: `notification-panel.tsx:69-81`  
**Problem**: If `fetchApi` throws (network error, 401), the error is unhandled. User gets no feedback.

**Fix**: Wrap in try/catch with toast or inline error state.

### M3. Notification type mismatch between WS events and DB schema

**File**: `notification-item.tsx:29-34` vs `notification-toast.tsx:5-10`  
**Problem**: Icon map uses types like `mention`, `comment_reply`, `assessment_assigned`, `announcement`. Toast uses `comment.new`, `comment.reply`, `announcement.new`, `assessment.assigned`. The DB `type` column and the WS event `type` use different naming conventions. When C2 is fixed, ensure consistency.

### M4. `NotificationData` type duplicated

**File**: `notification-panel.tsx:9-17` and `notification-item.tsx:3-11`  
**Problem**: Same interface defined twice. Extract to shared types file.

### M5. No max retry cap on WS reconnection

**File**: `use-websocket.ts:46-48`  
**Problem**: Exponential backoff caps at 30s but retries forever. If the server is down for hours, the client keeps trying every 30s. After many retries, this is fine for battery but generates server-side 4xx logs.

**Recommendation**: Add a max retry count (e.g., 50) and expose a `reconnect()` method for manual retry.

### M6. Cursor comparison uses string-to-number coercion

**File**: `notification-routes.ts:19`  
**Problem**: `Number(cursor)` could be `NaN` if cursor is malformed. No validation.

**Fix**: Validate cursor is a valid integer before using in query.

---

## Low Priority

- `notification-hub.ts:43`: Empty catch block -- consider logging reconnect closures
- `notification-panel.tsx:48`: Hardcoded `limit=30` in query -- should match the component's scroll behavior
- Toast z-index (60) might conflict with other modals -- verify with design system
- `timeAgo` in `notification-item.tsx` doesn't handle future timestamps

---

## Positive Observations

- Clean DO architecture: one hub per classroom, proper hibernation restore in constructor
- Broadcast correctly skips sender and supports recipient filtering
- Proper cleanup of existing WS on reconnect (hub line 41-45)
- Good cursor-based pagination pattern in notification list
- Notification panel uses React Query with staleTime -- avoids re-fetching on rapid open/close
- Auth middleware properly verifies Clerk JWT for REST endpoints
- Membership check before WS upgrade (would work if auth were fixed)

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix WS auth: pass Clerk token via query param, verify in WS route, handle token expiry
2. **[CRITICAL]** Add notification DB record creation before broadcasting
3. **[CRITICAL]** Ensure WS route is excluded from Bearer-header auth middleware (or use separate auth)
4. **[HIGH]** Add composite index on `(userId, createdAt)` for notifications table
5. **[HIGH]** Use ref pattern for onMessage to prevent reconnect storms from dependency changes
6. **[HIGH]** Replace optimistic unread increment with debounced API refresh
7. **[MEDIUM]** Unify notification type naming between WS events and DB records
8. **[MEDIUM]** Add error handling to mark-read operations
9. **[MEDIUM]** Extract shared `NotificationData` type
10. **[LOW]** Add max retry cap to WS reconnection

---

## Unresolved Questions

1. Is there a plan for multi-classroom WS connections? Current design only connects to one classroom at a time.
2. How are notification records supposed to be created? The comment in `realtime-service.ts` references "Phase 6" but no insertion logic exists. Was this an incomplete Phase 6 deliverable or a Phase 7 oversight?
3. Should WS connections persist across classroom navigation (e.g., via a global WS to a user-scoped DO) instead of classroom-scoped?
