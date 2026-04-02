import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { classroomMembers, users } from "../db/schema.js";

type DB = ReturnType<typeof drizzle>;

/** Add member by email — user must already exist in D1 */
export async function addMember(db: DB, classroomId: string, email: string, role: string) {
  // Look up user by email
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return { error: "User not registered — please add them to Clerk dashboard first" };
  }

  // Check for duplicate
  const [existing] = await db
    .select({ userId: classroomMembers.userId })
    .from(classroomMembers)
    .where(and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, user.id)))
    .limit(1);

  if (existing) {
    return { error: "User is already a member of this classroom" };
  }

  await db.insert(classroomMembers).values({
    classroomId,
    userId: user.id,
    role,
    joinedAt: Date.now(),
  });

  return { userId: user.id };
}

/** Remove member from classroom */
export async function removeMember(db: DB, classroomId: string, userId: string) {
  // Prevent removing the last teacher
  const teachers = await db
    .select({ userId: classroomMembers.userId })
    .from(classroomMembers)
    .where(and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.role, "teacher")));

  if (teachers.length === 1 && teachers[0].userId === userId) {
    return { error: "Cannot remove the last teacher from a classroom" };
  }

  await db
    .delete(classroomMembers)
    .where(and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, userId)));

  return { removed: true };
}

/** List members grouped by role */
export async function listMembers(db: DB, classroomId: string) {
  const rows = await db
    .select({
      userId: classroomMembers.userId,
      role: classroomMembers.role,
      joinedAt: classroomMembers.joinedAt,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(classroomMembers)
    .innerJoin(users, eq(classroomMembers.userId, users.id))
    .where(eq(classroomMembers.classroomId, classroomId));

  return rows;
}
