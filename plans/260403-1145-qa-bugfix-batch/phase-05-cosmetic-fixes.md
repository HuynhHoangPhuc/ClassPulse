# Phase 5 — Cosmetic & Polish Fixes

## Priority: LOW
## Status: Complete
## Effort: 0.5h

## Issues

### 5a. "1 members" pluralization (classroom detail page)

**File:** `apps/web/src/features/classrooms/classroom-detail-page.tsx` (line 96)

**Current:**
```tsx
<Users size={14} /> {classroom.memberCount} members
```

**Fix:**
```tsx
<Users size={14} /> {classroom.memberCount} member{classroom.memberCount !== 1 ? "s" : ""}
```

Note: `classroom-card.tsx` (line 49) already does this correctly.

---

### 5b. Clerk "Development mode" badge

Not a code fix — requires switching Clerk project to production mode in Clerk Dashboard. Document for deploy checklist.

**Action:** Add note to deployment docs or README that Clerk production keys must be used.

---

### 5c. Notification panel overlaps dashboard cards

**File:** `apps/web/src/features/notifications/notification-panel.tsx`

Low priority cosmetic — panel slides over content which is acceptable behavior. Could add a subtle push/overlay animation later but not blocking.

**Skip for now** — document as known minor UX item.

## Implementation Steps

### Step 1: Fix pluralization

**File:** `apps/web/src/features/classrooms/classroom-detail-page.tsx`

Single line change at line 96.

### Step 2: Document Clerk production switch

Add to deployment notes: switch `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to production Clerk instance keys.

## Todo List

- [x] Fix "1 members" → "1 member" pluralization
- [x] Document Clerk production key switch requirement

## Success Criteria

- "1 member" displays correctly for single-member classrooms
- Deployment docs mention Clerk production keys
