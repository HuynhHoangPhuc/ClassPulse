# Phase 4: Classroom

## Context

- [Phase 1 Foundation](./phase-01-foundation.md) — schema, auth, layouts
- [Design Guidelines §6.5](../../docs/design-guidelines.md) — Classroom page design

## Overview

- **Priority**: P1
- **Status**: Complete
- **Effort**: 10h
- **Depends On**: Phase 1
- **Description**: Classroom CRUD, member management (teacher adds students/parents), announcement posts, assessment assignment, unified classroom feed.

## Key Insights

- Users can participate in multiple classrooms
- Assessments can be assigned to multiple classrooms (reusable)
- Posts are unified feed: announcements + assessment assignments
- Comments come in Phase 6 (this phase: feed without comments)
- Invite code for easy sharing (no email invites yet — teacher adds by email in Clerk)

## Requirements

### Functional
- Classroom CRUD (teacher only)
- Member management: add by email, assign role, remove
- Unique invite code per classroom
- Announcement posts with markdown content
- Assessment assignment: link existing assessment + set due date
- Unified feed sorted by created_at
- Tab navigation: Feed, Members, Assessments, Settings

### Non-Functional
- Classroom feed loads in < 500ms
- Member list handles up to 200 members per classroom

## Architecture

### API Routes

```
GET    /api/classrooms                 — List user's classrooms (by role)
POST   /api/classrooms                 — Create classroom (teacher)
GET    /api/classrooms/:id             — Get classroom detail
PUT    /api/classrooms/:id             — Update classroom (teacher)
DELETE /api/classrooms/:id             — Archive classroom (teacher)

GET    /api/classrooms/:id/members     — List members
POST   /api/classrooms/:id/members     — Add member (by email + role)
DELETE /api/classrooms/:id/members/:userId — Remove member

GET    /api/classrooms/:id/feed        — Get posts feed (paginated)
POST   /api/classrooms/:id/posts       — Create post (announcement or assignment)
PUT    /api/classrooms/:id/posts/:postId — Update post
DELETE /api/classrooms/:id/posts/:postId — Delete post
```

### Authorization Matrix

| Action | Teacher | Student | Parent |
|--------|---------|---------|--------|
| Create classroom | Yes | No | No |
| Manage members | Yes | No | No |
| Create announcement | Yes | No | No |
| Assign assessment | Yes | No | No |
| View feed | Yes | Yes | Yes |
| View members | Yes | Yes | Yes |
| View settings | Yes | No | No |

## Related Code Files

### Files to Create
- `apps/api/src/routes/classroom-routes.ts` — Classroom endpoints
- `apps/api/src/routes/classroom-member-routes.ts` — Member endpoints
- `apps/api/src/routes/classroom-post-routes.ts` — Post/feed endpoints
- `apps/api/src/services/classroom-service.ts` — Business logic
- `apps/api/src/services/classroom-member-service.ts`
- `apps/web/src/features/classrooms/` — Classroom feature module
  - `classroom-list-page.tsx` — List of user's classrooms
  - `classroom-detail-page.tsx` — Tab-based detail view
  - `classroom-feed-tab.tsx` — Feed tab with posts
  - `classroom-members-tab.tsx` — Members management
  - `classroom-assessments-tab.tsx` — Assigned assessments overview
  - `classroom-settings-tab.tsx` — Settings (teacher only)
  - `post-composer.tsx` — New post form (announcement/assignment)
  - `post-card.tsx` — Feed post card
  - `member-list.tsx` — Member list with roles
  - `add-member-dialog.tsx` — Add member by email
  - `classroom-card.tsx` — Card for classroom list
- `packages/shared/src/schemas/classroom-schemas.ts`

## Implementation Steps

### 1. Classroom CRUD API (2h)

1. Create/update/delete classroom endpoints (teacher_id enforced)
2. Auto-generate unique invite code (6-char alphanumeric) on create
3. List endpoint returns classrooms where user is a member (any role)
4. Detail endpoint returns classroom + member count + recent post count

### 2. Member Management API (2h)

1. Add member: look up user by email in D1, add to classroom_members with role
   - If user not in D1 yet: return error "User not registered — please add them to Clerk dashboard first"
   - **Validated**: MVP uses pre-registration in Clerk. Invite flow deferred to future phase.
2. Remove member: delete from classroom_members (teacher only)
3. List members: grouped by role, include avatar + name + email
4. Prevent: removing last teacher, adding duplicate members

### 3. Post/Feed API (2h)

1. Create post: type = announcement (with markdown content) or assessment_assignment (with assessment_id + due_date)
2. Feed endpoint: paginated list of posts, joined with author data
3. For assessment_assignment posts: include assessment title, question count, time limit
4. Update/delete post (author or classroom teacher only)

### 4. Classroom List Page (1h)

1. Grid of classroom cards: name, description, member count, role badge
2. "Create Classroom" button (teacher only)
3. Create dialog: name, description → creates classroom, shows invite code
4. Empty state per design guidelines

### 5. Classroom Detail Page (3h)

1. Header: classroom name, description, member count, invite code (copy button)
2. Tab navigation: Feed | Members | Assessments | Settings

**Feed Tab:**
- Post composer at top (expandable): type toggle (Announcement/Assessment)
  - Announcement: markdown editor
  - Assessment: assessment picker (search/select) + due date picker
- Post cards: author avatar + name + role badge + time + content
- Assessment posts: embedded card with title, time limit, due date countdown
- Paginated feed with "Load more"

**Members Tab:**
- Grouped by role: Teachers, Students, Parents
- Each: avatar, name, email, role badge
- Add member button → dialog: email input + role selector
- Remove button with confirmation (teacher only)

**Assessments Tab:**
- Table: assessment title, due date, student completion status
- Shows: not started / in progress / submitted counts
- Links to detailed results (Phase 5)

**Settings Tab (teacher only):**
- Edit name, description
- Regenerate invite code
- Archive classroom (soft delete with confirmation)

## Todo

- [x] Create classroom CRUD API with invite code generation
- [x] Create member management API (add by email, remove)
- [x] Create post/feed API (announcements + assessment assignments)
- [x] Build classroom list page with create dialog
- [x] Build classroom detail page with tab navigation
- [x] Build feed tab with post composer and post cards
- [x] Build members tab with add/remove functionality
- [x] Build assessments tab (completion overview)
- [x] Build settings tab (edit, regenerate code, archive)
- [x] Add authorization checks per role per action
- [x] Add empty states for each tab

## Success Criteria

- Teacher can create classroom with unique invite code
- Teacher can add/remove students and parents by email
- Teacher can post announcements with markdown
- Teacher can assign assessments with due dates
- Students and parents see unified feed
- Tab navigation works smoothly
- Authorization enforced (students can't create posts)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| User not in D1 when adding member | Medium | Clear error message, suggest checking Clerk dashboard |
| Invite code collision | Low | Retry generation on unique constraint violation |
| Feed performance with many posts | Low | Cursor pagination, limit to 20 per page |

## Security

- All classroom operations check membership first
- Teacher-only actions enforced server-side (not just UI hiding)
- Invite code is display-only (no join-by-code in MVP — teacher adds manually)
- Post deletion only by author or classroom teacher
