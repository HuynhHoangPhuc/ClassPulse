# Phase 6: Comments & Mentions

## Context

- [Phase 4 Classroom](./phase-04-classroom.md) — posts in feed
- [Design Guidelines §6.5](../../docs/design-guidelines.md) — Classroom comments design

## Overview

- **Priority**: P2
- **Status**: Pending
- **Effort**: 8h
- **Depends On**: Phase 4
- **Description**: Threaded comments on classroom posts, @mention with autocomplete (classroom members), comment edit/delete, mention notifications stored in DB (real-time push in Phase 7).

## Key Insights

- Comments are threaded: max 2 levels deep in UI (parent comment → replies)
- @mention format in markdown: `@[User Name](user_id)` — parsed on save, rendered as link
- Mention autocomplete triggers on `@` character in comment input
- Notifications created on mention/reply but NOT pushed in real-time until Phase 7
- Comments support markdown (simpler subset: bold, italic, code, links)

## Requirements

### Functional
- Add comment on any post
- Reply to comment (one level of nesting)
- Edit own comment
- Delete own comment (or teacher deletes any in their classroom)
- @mention autocomplete showing classroom members
- Mention creates notification record for mentioned user
- Reply creates notification for parent comment author
- Comment count shown on post card

### Non-Functional
- Comment autocomplete responds in < 100ms (search classroom members)
- Comments load with post (not separate request)
- Max comment length: 2000 characters

## Architecture

### API Routes

```
GET    /api/posts/:postId/comments          — List comments (threaded)
POST   /api/posts/:postId/comments          — Create comment
PUT    /api/comments/:id                    — Edit comment
DELETE /api/comments/:id                    — Delete comment
GET    /api/classrooms/:id/members/search   — Search members for @mention
```

### Comment Threading Model

```
Post
├── Comment A (parent_comment_id: null)
│   ├── Reply A1 (parent_comment_id: A)
│   └── Reply A2 (parent_comment_id: A)
├── Comment B (parent_comment_id: null)
│   └── Reply B1 (parent_comment_id: B)
└── Comment C (parent_comment_id: null)

UI renders max 2 levels. Replies to replies → shown flat under same parent.
```

### Mention Processing

```
Input:  "Hey @[John Doe](user_123) check this out"
Parse:  Extract user IDs from @[...](user_id) pattern
Store:  Insert into comment_mentions table
Notify: Create notification record for user_123
Render: Display as styled link with user name
```

## Related Code Files

### Files to Create
- `apps/api/src/routes/comment-routes.ts` — Comment CRUD
- `apps/api/src/services/comment-service.ts` — Comment logic + mention extraction
- `apps/api/src/services/notification-service.ts` — Create notification records
- `apps/web/src/features/classrooms/` — (extend)
  - `comment-section.tsx` — Threaded comment list
  - `comment-item.tsx` — Single comment with reply button
  - `comment-input.tsx` — Input with @mention autocomplete
  - `mention-autocomplete.tsx` — Dropdown for @mention
  - `mention-renderer.tsx` — Render @mentions as styled links
- `packages/shared/src/schemas/comment-schemas.ts`

## Implementation Steps

### 1. Comment CRUD API (2h)

1. List comments: fetch by post_id, include author data (joined), return flat list with parent_comment_id for client-side threading
2. Create comment: validate post exists, user is classroom member, extract mentions, insert comment + comment_mentions in transaction
3. Edit comment: author only, re-extract mentions, update comment_mentions
4. Delete comment: author or classroom teacher. Soft delete (set content to "[deleted]") if has replies, hard delete if no replies

### 2. Mention Extraction & Notifications (1.5h)

1. Parse `@[Name](user_id)` regex from comment content
2. Validate mentioned user_ids are classroom members
3. Insert into `comment_mentions` table
4. Create notification records:
   - Type `mention`: for each @mentioned user
   - Type `comment_reply`: for parent comment author (if replying)
   - Skip self-mentions and self-replies
5. Notification records stored in DB, read via notifications API (Phase 7 adds real-time push)

### 3. Member Search API (0.5h)

1. `GET /api/classrooms/:id/members/search?q=john`
2. Search by name or email, return top 10 matches
3. Used by @mention autocomplete

### 4. Comment Section UI (2h)

1. Comment list below each post (expandable: "View X comments")
2. Thread rendering: top-level comments → indented replies (max 1 indent level)
3. Each comment: avatar + name + role badge + timestamp + content + actions (reply, edit, delete)
4. Reply button: opens inline input below comment
5. Edit: replace content with editable input, save/cancel
6. Delete: confirmation dialog

### 5. @Mention Autocomplete (2h)

1. Comment input: textarea with @mention detection
2. On typing `@` followed by text: trigger search API
3. Show dropdown below cursor with matching members (avatar + name + role)
4. On select: insert `@[Name](user_id)` at cursor position
5. Render mentions as styled chips/links in comment display
6. Use `mention-renderer.tsx` to parse and render `@[...](...)` as styled components

## Todo

- [ ] Create comment CRUD API endpoints
- [ ] Implement mention extraction from comment content
- [ ] Create notification records on mention/reply
- [ ] Create member search API for autocomplete
- [ ] Build threaded comment section component
- [ ] Build comment item with reply/edit/delete actions
- [ ] Build comment input with @mention detection
- [ ] Build mention autocomplete dropdown
- [ ] Build mention renderer for display
- [ ] Update post cards to show comment count
- [ ] Test mention parsing with edge cases
- [ ] Test authorization (edit own, teacher delete any)

## Success Criteria

- Users can comment on posts, reply to comments
- @mention autocomplete shows classroom members
- Mentions create notification records in DB
- Replies notify parent comment author
- Edit and delete work with proper authorization
- Comments render with styled @mentions
- Comment count shows on post cards

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| @mention regex fails on edge cases | Medium | Thorough regex testing, sanitize input |
| Comment threading complex for deep nesting | Low | Cap at 2 levels in UI, flatten deeper |
| Autocomplete flicker on fast typing | Low | Debounce search API calls (200ms) |

## Security

- Comments only by classroom members
- Edit only own comments; delete: own or classroom teacher
- Validate mentioned users are classroom members
- Sanitize markdown to prevent XSS (react-markdown handles this)
- Rate limit comment creation (10 per minute per user)
