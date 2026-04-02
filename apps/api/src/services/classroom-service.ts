import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { classrooms, classroomMembers, users } from "../db/schema.js";
import { generateId } from "../lib/id-generator.js";
import type { z } from "zod";
import type { createClassroomSchema, updateClassroomSchema } from "@teaching/shared";

type DB = ReturnType<typeof drizzle>;
type CreateInput = z.infer<typeof createClassroomSchema>;
type UpdateInput = z.infer<typeof updateClassroomSchema>;

/** Generate a 6-char alphanumeric invite code */
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Create classroom and add teacher as first member */
export async function createClassroom(db: DB, teacherId: string, input: CreateInput) {
  const now = Date.now();
  const id = generateId();
  const inviteCode = generateInviteCode();

  await db.insert(classrooms).values({
    id,
    teacherId,
    name: input.name,
    description: input.description ?? null,
    inviteCode,
    createdAt: now,
    updatedAt: now,
  });

  // Add teacher as first member
  await db.insert(classroomMembers).values({
    classroomId: id,
    userId: teacherId,
    role: "teacher",
    joinedAt: now,
  });

  return getClassroomById(db, id);
}

/** Get classroom with member count */
export async function getClassroomById(db: DB, id: string) {
  const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, id)).limit(1);
  if (!classroom) return null;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(classroomMembers)
    .where(eq(classroomMembers.classroomId, id));

  return { ...classroom, memberCount: countRow?.count ?? 0 };
}

/** List classrooms where user is a member */
export async function listClassrooms(db: DB, userId: string) {
  const memberships = await db
    .select({
      classroomId: classroomMembers.classroomId,
      role: classroomMembers.role,
    })
    .from(classroomMembers)
    .where(eq(classroomMembers.userId, userId));

  if (memberships.length === 0) return [];

  const classroomIds = memberships.map((m) => m.classroomId);
  const roleMap = Object.fromEntries(memberships.map((m) => [m.classroomId, m.role]));

  const rows = await db
    .select()
    .from(classrooms)
    .where(sql`${classrooms.id} IN (${sql.join(classroomIds.map((cid) => sql`${cid}`), sql`, `)})`);

  // Batch fetch member counts (avoids N+1)
  const countRows = await db
    .select({
      classroomId: classroomMembers.classroomId,
      count: sql<number>`count(*)`,
    })
    .from(classroomMembers)
    .where(sql`${classroomMembers.classroomId} IN (${sql.join(classroomIds.map((cid) => sql`${cid}`), sql`, `)})`)
    .groupBy(classroomMembers.classroomId);

  const countMap: Record<string, number> = {};
  for (const row of countRows) countMap[row.classroomId] = row.count;

  return rows.map((c) => ({
    ...c,
    memberCount: countMap[c.id] ?? 0,
    userRole: roleMap[c.id],
  }));
}

/** Update classroom (teacher only) */
export async function updateClassroom(db: DB, id: string, input: UpdateInput) {
  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description ?? null;

  await db.update(classrooms).set(updates).where(eq(classrooms.id, id));
  return getClassroomById(db, id);
}

/** Delete (archive) classroom */
export async function deleteClassroom(db: DB, id: string) {
  await db.batch([
    db.delete(classroomMembers).where(eq(classroomMembers.classroomId, id)),
    db.delete(classrooms).where(eq(classrooms.id, id)),
  ]);
}

/** Regenerate invite code */
export async function regenerateInviteCode(db: DB, id: string) {
  const newCode = generateInviteCode();
  await db.update(classrooms).set({ inviteCode: newCode, updatedAt: Date.now() }).where(eq(classrooms.id, id));
  return newCode;
}

/** Check if user is teacher of classroom */
export async function isClassroomTeacher(db: DB, classroomId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ role: classroomMembers.role })
    .from(classroomMembers)
    .where(and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, userId)))
    .limit(1);
  return row?.role === "teacher";
}

/** Check if user is a member of classroom */
export async function isClassroomMember(db: DB, classroomId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: classroomMembers.userId })
    .from(classroomMembers)
    .where(and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, userId)))
    .limit(1);
  return !!row;
}
