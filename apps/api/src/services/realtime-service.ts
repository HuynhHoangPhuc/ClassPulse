/**
 * Triggers real-time notifications via classroom Durable Objects.
 * Called after DB notification records are created (Phase 6).
 */

interface NotificationEvent {
  type: string;
  data: unknown;
  recipients?: string[];
  senderId?: string;
}

interface EnvBindings {
  NOTIFICATION_HUB: DurableObjectNamespace;
}

/** Broadcast an event to all connected clients in a classroom */
export async function notifyClassroom(env: EnvBindings, classroomId: string, event: NotificationEvent) {
  const id = env.NOTIFICATION_HUB.idFromName(classroomId);
  const stub = env.NOTIFICATION_HUB.get(id);
  await stub.fetch("https://internal/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
}
