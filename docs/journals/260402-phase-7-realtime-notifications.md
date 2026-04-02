# Phase 7: Real-time Notifications Implementation

**Date**: 2026-04-02 14:30
**Severity**: Medium
**Component**: Notifications, WebSocket, Durable Objects
**Status**: Resolved

## What Happened

Implemented Phase 7 real-time notifications using Cloudflare Durable Objects + WebSocket. Integrated with existing post creation flow to trigger both database records and live broadcasts to classroom sessions.

## The Brutal Truth

Browser WebSocket APIs don't support custom headers—learned this the hard way when initial auth failed silently. Took 2 hours of "why isn't the connection working?" before catching the real issue: query param tokens aren't documented as standard practice, but they're the only browser-compatible approach.

## Technical Details

- **WebSocket auth**: JWT in query param (`?token=...`) instead of headers
- **Type naming**: Unified to underscore format (`comment_reply`, `post_like`, etc.) across DB/icons/events
- **Architecture**: One Durable Object per classroom (not per user)—efficient at 100K requests/day free tier limit
- **Fallback**: DB notifications are source of truth; DO broadcast enhances with real-time delivery

```typescript
// WS upgrade outside /api/* auth guard, JWT verified from query param
POST /api/classroom/:id/ws
Query: token=eyJhbGc...

// Notification creation triggered on post save
createNotifications(post) → [DB records + DO.broadcast()]
```

## Root Cause Analysis

1. **WebSocket header limitation**: Assumed auth headers would work; browser security model prevents custom headers on WS connections
2. **Type inconsistency**: Mixed dot-notation in code (comment.new) vs underscore in DB (comment_reply); caught during code review
3. **Missing DB sync**: Post creation wasn't calling createNotifications()—offline users never saw events

## Lessons Learned

- Browser WebSocket auth defaults to query params; document this immediately to avoid tribal knowledge
- Unify enum/constant naming across layers (DB, backend, frontend) early; inconsistency multiplies at scale
- Real-time + persistence requires dual writes (DB + broadcast); one without the other is incomplete

## Next Steps

Phase 8 (Parent Dashboard) is final phase. All notifications infrastructure ready for parent-facing features.

**Commit**: 099dbcb
