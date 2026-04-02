import { drizzle } from "drizzle-orm/d1";
import { notifications } from "../db/schema.js";
import { generateId } from "../lib/id-generator.js";

type DB = ReturnType<typeof drizzle>;

interface CreateNotificationInput {
  userId: string;
  type: string;
  referenceType: string;
  referenceId: string;
  message: string;
}

/** Create a single notification record */
export async function createNotification(db: DB, input: CreateNotificationInput) {
  const id = generateId();
  await db.insert(notifications).values({
    id,
    userId: input.userId,
    type: input.type,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    message: input.message,
    isRead: 0,
    createdAt: Date.now(),
  });
  return id;
}

/** Create multiple notification records (for batch mentions) */
export async function createNotifications(db: DB, inputs: CreateNotificationInput[]) {
  if (inputs.length === 0) return;
  const now = Date.now();
  const values = inputs.map((input) => ({
    id: generateId(),
    userId: input.userId,
    type: input.type,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    message: input.message,
    isRead: 0,
    createdAt: now,
  }));
  await db.insert(notifications).values(values);
}
