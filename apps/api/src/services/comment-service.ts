import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { comments, commentMentions, users, classroomMembers, posts } from "../db/schema.js";
import { generateId } from "../lib/id-generator.js";
import { createNotifications } from "./notification-service.js";

type DB = ReturnType<typeof drizzle>;

/** Extract @[Name](user_id) patterns from content */
export function extractMentions(content: string): string[] {
  const regex = /@\[([^\]]*)\]\(([^)]+)\)/g;
  const userIds: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    userIds.push(match[2]);
  }
  return [...new Set(userIds)];
}

/** List comments for a post with author info, flat list for client-side threading */
export async function listComments(db: DB, postId: string) {
  const rows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      authorId: comments.authorId,
      parentCommentId: comments.parentCommentId,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
      authorRole: users.role,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(sql`${comments.createdAt} ASC`);

  return rows;
}

/** Create a comment with mention extraction and notifications */
export async function createComment(
  db: DB,
  postId: string,
  authorId: string,
  content: string,
  parentCommentId: string | null,
  mentionUserIds: string[],
) {
  const now = Date.now();
  const id = generateId();

  // Insert comment
  await db.insert(comments).values({
    id,
    postId,
    authorId,
    parentCommentId: parentCommentId ?? null,
    content,
    createdAt: now,
    updatedAt: now,
  });

  // Get post to find classroom for member validation
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) return id;

  // Validate mentioned users are classroom members
  const validMentionIds = await filterClassroomMembers(db, post.classroomId, mentionUserIds);

  // Insert mention records
  if (validMentionIds.length > 0) {
    await db.insert(commentMentions).values(
      validMentionIds.map((userId) => ({ commentId: id, userId })),
    );
  }

  // Build notification list (skip self-mentions and self-replies)
  const notifs: { userId: string; type: string; message: string }[] = [];

  // Mention notifications
  for (const userId of validMentionIds) {
    if (userId !== authorId) {
      notifs.push({ userId, type: "mention", message: "mentioned you in a comment" });
    }
  }

  // Reply notification for parent comment author
  if (parentCommentId) {
    const [parent] = await db
      .select({ authorId: comments.authorId })
      .from(comments)
      .where(eq(comments.id, parentCommentId))
      .limit(1);

    if (parent && parent.authorId !== authorId && !validMentionIds.includes(parent.authorId)) {
      notifs.push({ userId: parent.authorId, type: "comment_reply", message: "replied to your comment" });
    }
  }

  // Create notifications
  if (notifs.length > 0) {
    await createNotifications(
      db,
      notifs.map((n) => ({
        userId: n.userId,
        type: n.type,
        referenceType: "comment",
        referenceId: id,
        message: n.message,
      })),
    );
  }

  return id;
}

/** Update comment content and re-process mentions */
export async function updateComment(
  db: DB,
  commentId: string,
  content: string,
  mentionUserIds: string[],
) {
  await db
    .update(comments)
    .set({ content, updatedAt: Date.now() })
    .where(eq(comments.id, commentId));

  // Get comment's post for classroom validation
  const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (!comment) return;

  const [post] = await db.select().from(posts).where(eq(posts.id, comment.postId)).limit(1);
  if (!post) return;

  // Re-sync mentions: delete old, insert new
  await db.delete(commentMentions).where(eq(commentMentions.commentId, commentId));

  const validMentionIds = await filterClassroomMembers(db, post.classroomId, mentionUserIds);
  if (validMentionIds.length > 0) {
    await db.insert(commentMentions).values(
      validMentionIds.map((userId) => ({ commentId, userId })),
    );
  }
}

/** Delete comment: soft delete if has replies, hard delete otherwise */
export async function deleteComment(db: DB, commentId: string) {
  // Check if comment has replies
  const [replyCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(eq(comments.parentCommentId, commentId));

  if (replyCount && replyCount.count > 0) {
    // Soft delete: replace content
    await db
      .update(comments)
      .set({ content: "[deleted]", updatedAt: Date.now() })
      .where(eq(comments.id, commentId));
  } else {
    // Hard delete: remove mentions first, then comment
    await db.delete(commentMentions).where(eq(commentMentions.commentId, commentId));
    await db.delete(comments).where(eq(comments.id, commentId));
  }
}

/** Get comment counts for multiple posts (batch, avoids N+1) */
export async function getCommentCounts(db: DB, postIds: string[]) {
  if (postIds.length === 0) return {};

  const rows = await db
    .select({
      postId: comments.postId,
      count: sql<number>`count(*)`,
    })
    .from(comments)
    .where(sql`${comments.postId} IN (${sql.join(postIds.map((id) => sql`${id}`), sql`, `)})`)
    .groupBy(comments.postId);

  const map: Record<string, number> = {};
  for (const row of rows) map[row.postId] = row.count;
  return map;
}

/** Search classroom members by name (for @mention autocomplete) */
export async function searchClassroomMembers(db: DB, classroomId: string, query: string) {
  const rows = await db
    .select({
      userId: classroomMembers.userId,
      role: classroomMembers.role,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(classroomMembers)
    .innerJoin(users, eq(classroomMembers.userId, users.id))
    .where(
      and(
        eq(classroomMembers.classroomId, classroomId),
        sql`LOWER(${users.name}) LIKE ${"%" + query.toLowerCase() + "%"}`,
      ),
    )
    .limit(10);

  return rows;
}

/** Filter user IDs to only those who are members of the classroom */
async function filterClassroomMembers(db: DB, classroomId: string, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];

  const rows = await db
    .select({ userId: classroomMembers.userId })
    .from(classroomMembers)
    .where(
      and(
        eq(classroomMembers.classroomId, classroomId),
        sql`${classroomMembers.userId} IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`,
      ),
    );

  return rows.map((r) => r.userId);
}
