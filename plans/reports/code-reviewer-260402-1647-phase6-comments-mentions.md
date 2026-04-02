# Code Review: Phase 6 — Comments & Mentions

**Date:** 2026-04-02  
**Reviewer:** code-reviewer  
**Status:** DONE_WITH_CONCERNS

## Scope

- **Files reviewed:** 13 (8 new, 5 modified)
- **Backend:** notification-service, comment-service, comment-routes, classroom-post-routes, index.ts
- **Frontend:** mention-renderer, mention-autocomplete, comment-input, comment-item, comment-section, post-card, classroom-feed-tab
- **Shared:** schemas/index.ts (createCommentSchema, updateCommentSchema)

## Overall Assessment

Solid implementation. Auth checks present on all endpoints, N+1 queries prevented via batch comment counts, clean component decomposition. Several medium-severity issues found that should be addressed before production.

---

## Critical Issues

### 1. XSS via MentionRenderer — mention name is user-controlled (HIGH)

**File:** `apps/web/src/features/classrooms/mention-renderer.tsx:30`

The `@[Name](userId)` pattern is parsed from comment content. The `Name` portion is rendered directly as text content in a `<span>`. In React, this is safe since JSX auto-escapes text content. **No XSS here** — React handles this correctly.

**Verdict:** Not actually vulnerable. React's JSX escaping protects against XSS in text nodes.

### 2. Mention format injection in comment content (MEDIUM-HIGH)

**File:** `apps/api/src/services/comment-service.ts:10-18`

A user can craft comment content with arbitrary `@[FakeName](victimUserId)` patterns. The `extractMentions` function on the backend extracts user IDs from content, but the route handler uses `mentionUserIds` from the request body (not from content parsing). However, `updateComment` at line 121-148 also re-syncs mentions from the `mentionUserIds` parameter.

The **real risk**: `comment-item.tsx:63-67` extracts mention IDs from edited content client-side via regex. If a user edits the raw content to include `@[FakeAdmin](someUserId)`, it would:
1. Display "FakeAdmin" as a mention chip (misleading but not security-breaking since it's just text)
2. Create a mention record for `someUserId` (validated as classroom member, so bounded)

**Impact:** Low. Mention records are validated against classroom membership. Display is cosmetic only.

---

## High Priority

### 3. Missing membership check on PUT /comments/:id (AUTH GAP)

**File:** `apps/api/src/routes/comment-routes.ts:78-98`

The edit endpoint checks `authorId === userId` but does NOT verify the user is still a classroom member. If a user is removed from a classroom, they can still edit their existing comments.

**Fix:** After fetching the comment, also fetch the post and verify `isClassroomMember(db, post.classroomId, userId)`.

```typescript
// After line 90, add:
const [post] = await db.select().from(posts).where(eq(posts.id, existing.postId)).limit(1);
if (!post) return c.json({ error: "Post not found" }, 404);
if (!(await isClassroomMember(db, post.classroomId, userId))) {
  return c.json({ error: "Not a member of this classroom" }, 403);
}
```

### 4. Missing membership check on DELETE /comments/:id

**File:** `apps/api/src/routes/comment-routes.ts:100-119`

Same issue as #3. The delete endpoint checks author/teacher but not current membership. A removed member could delete their own comments.

**Impact:** Medium — allows ex-members to modify classroom data.

### 5. Orphaned mentions when post is deleted

**File:** `apps/api/src/routes/classroom-post-routes.ts:182`

When a post is deleted (`DELETE /:id/posts/:postId`), associated comments and their mention records are NOT cascade-deleted. The schema uses `.references(() => posts.id)` but SQLite foreign keys require `PRAGMA foreign_keys = ON` to enforce cascades, and even then, no `ON DELETE CASCADE` is defined.

**Impact:** Data leak — orphaned rows accumulate in `comments` and `comment_mentions` tables.

**Fix:** Either:
- Add `ON DELETE CASCADE` to the schema, OR
- Delete comments and mentions before deleting the post in the route handler

### 6. No error handling on comment API calls (frontend)

**File:** `apps/web/src/features/classrooms/comment-section.tsx:59-90`

`handleCreate`, `handleReply`, `handleEdit`, `handleDelete` — none have try/catch. If `fetchApi` throws (network error, 403, 500), the error propagates unhandled to React, potentially crashing the component tree.

**Fix:** Wrap each in try/catch with user-facing error feedback (toast/inline error).

```typescript
async function handleCreate(content: string, mentionUserIds: string[]) {
  try {
    const token = await getToken();
    await fetchApi(...);
    invalidate();
  } catch (err) {
    // Show error toast
    console.error("Failed to create comment:", err);
  }
}
```

---

## Medium Priority

### 7. `useMentionDetection` regex only matches `\w` characters

**File:** `apps/web/src/features/classrooms/mention-autocomplete.tsx:89`

Pattern `/@(\w*)$/` only matches ASCII word chars. Users with names containing spaces, accents, or CJK chars won't trigger autocomplete after typing `@`.

**Impact:** Broken mention autocomplete for non-ASCII names. The `\w*` allows empty match too (just `@`), which is fine for triggering the dropdown.

**Fix:** Use `/@([^\s@]*)$/` to match everything except whitespace and `@`.

### 8. `mentionIdsRef` in CommentInput is not reset when user manually removes a mention

**File:** `apps/web/src/features/classrooms/comment-input.tsx:16,27`

If a user selects a mention (adds to `mentionIdsRef`), then manually deletes the `@[Name](id)` text, the ID remains in the set. On submit, the backend receives mention IDs for mentions no longer in content.

**Impact:** Phantom mention notifications sent to users who were de-mentioned. Backend `filterClassroomMembers` validates membership but not content presence.

**Fix:** Before submit, re-extract mentions from content (like `comment-item.tsx:63-67` does for edit) instead of relying on accumulated state:

```typescript
async function handleSubmit() {
  const trimmed = value.trim();
  if (!trimmed || loading) return;
  // Re-extract mentions from final content
  const mentionRegex = /@\[[^\]]*\]\(([^)]+)\)/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = mentionRegex.exec(trimmed)) !== null) ids.push(m[1]);
  setLoading(true);
  try {
    await onSubmit(trimmed, [...new Set(ids)]);
    setValue("");
    mentionIdsRef.current.clear();
  } finally {
    setLoading(false);
  }
}
```

### 9. Duplicate `timeAgo` function

**Files:** `post-card.tsx:24-33` and `comment-item.tsx:30-38`

Identical implementation duplicated. Extract to a shared utility.

### 10. Duplicate `CommentData` interface

**Files:** `comment-item.tsx:7-17` and `comment-section.tsx:9-20`

Same interface defined twice. Extract to a shared types file.

### 11. `searchClassroomMembers` LIKE query without sanitization of `%` and `_`

**File:** `apps/api/src/services/comment-service.ts:203`

The query parameter is interpolated into a LIKE pattern: `"%" + query.toLowerCase() + "%"`. If the user types `%` or `_`, these are LIKE wildcards and would match more than intended.

**Impact:** Low — worst case returns broader results than expected. Not a security issue since results are bounded by classroom membership and `LIMIT 10`.

**Fix:** Escape `%` and `_` in the query string before LIKE:
```typescript
const escapedQuery = query.toLowerCase().replace(/%/g, '\\%').replace(/_/g, '\\_');
```

### 12. No pagination on `listComments`

**File:** `apps/api/src/services/comment-service.ts:21-41`

All comments for a post are fetched at once with no limit. A heavily-commented post could return thousands of rows.

**Impact:** Performance degradation for popular posts.

**Fix:** Add pagination (cursor-based, like the feed) or at minimum a `LIMIT 200`.

---

## Low Priority

### 13. `deleteComment` soft-delete leaves orphaned mention records

**File:** `apps/api/src/services/comment-service.ts:151-169`

When soft-deleting (content = "[deleted]"), the mention records in `comment_mentions` are NOT cleared. These mentions reference a deleted comment, which could confuse future queries.

### 14. Autocomplete debounce fires on every keystroke even when not in mention mode

**File:** `apps/web/src/features/classrooms/mention-autocomplete.tsx:26-44`

The effect fires whenever `query` changes, even if `visible` is false. The early return on line 27 handles this, but the `clearTimeout` on line 33 still runs unnecessarily.

### 15. `comment-section.tsx` reply input nesting depth

Only top-level comments show "Reply" button (`isReply` check at line 133-142 in comment-item). Replies cannot have replies. This is good — prevents infinite nesting. No issue.

---

## Positive Observations

1. **N+1 prevention**: `getCommentCounts` batch-fetches comment counts for all posts in a feed page — well done
2. **Auth on every endpoint**: All routes check membership/ownership before data access
3. **Parent comment validation**: `POST /comments` verifies parent belongs to same post — prevents cross-post threading attacks
4. **Mention validation**: `filterClassroomMembers` ensures only actual classroom members can be mentioned
5. **Self-mention/reply suppression**: No notification sent when mentioning/replying to yourself
6. **Soft delete strategy**: Comments with replies are soft-deleted to preserve thread structure
7. **Lazy loading**: Comments only fetched when section is expanded
8. **Query invalidation**: Both comment list and feed comment count are invalidated on mutations
9. **Debounced autocomplete**: 200ms debounce prevents excessive API calls

---

## Recommended Actions (Priority Order)

1. **[HIGH]** Add membership checks to PUT and DELETE comment routes (#3, #4)
2. **[HIGH]** Add cascade deletion or manual cleanup for comments when posts are deleted (#5)
3. **[HIGH]** Add error handling (try/catch) to all frontend API mutation calls (#6)
4. **[MEDIUM]** Fix mention ID tracking to re-extract from content on submit (#8)
5. **[MEDIUM]** Add pagination or limit to `listComments` (#12)
6. **[MEDIUM]** Fix `useMentionDetection` regex for non-ASCII names (#7)
7. **[LOW]** Extract shared `timeAgo` utility and `CommentData` type (#9, #10)
8. **[LOW]** Clear mention records on soft-delete (#13)

---

## Unresolved Questions

- Is `PRAGMA foreign_keys` enabled on the D1 database? If so, deleting a post without first deleting comments would fail with a foreign key constraint error rather than silently orphaning rows.
- Should there be rate limiting on comment creation to prevent spam?
- Should the notification records have a TTL or cleanup mechanism?
