import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users } from "../db/schema.js";
import type { Env } from "../env.js";
import { USER_ROLES, type UserRole } from "@teaching/shared";

type Variables = { userId: string };

const usersRoute = new Hono<Env & { Variables: Variables }>();

// GET /api/users/me — returns the authenticated user's record from D1
usersRoute.get("/me", async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(user);
});

// POST /webhook/clerk — syncs Clerk user.created / user.updated events to D1
// This route is mounted WITHOUT auth middleware (no Bearer token from Clerk webhooks)
const clerkWebhookRoute = new Hono<Env>();

clerkWebhookRoute.post("/", async (c) => {
  // Verify Clerk webhook signature (Svix)
  const webhookSecret = c.env.CLERK_WEBHOOK_SECRET;
  if (webhookSecret) {
    const svixId = c.req.header("svix-id");
    const svixTimestamp = c.req.header("svix-timestamp");
    const svixSignature = c.req.header("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return c.json({ error: "Missing webhook signature headers" }, 401);
    }

    // Verify timestamp is within 5 minutes to prevent replay attacks
    const timestampSeconds = parseInt(svixTimestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampSeconds) > 300) {
      return c.json({ error: "Webhook timestamp too old" }, 401);
    }

    // Verify HMAC signature
    const rawBody = await c.req.text();
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    const secretBytes = Uint8Array.from(
      atob(webhookSecret.replace("whsec_", "")),
      (ch) => ch.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
    const expectedSig = btoa(String.fromCharCode(...new Uint8Array(sig)));

    // Svix sends multiple signatures separated by spaces, each prefixed with version
    const signatures = svixSignature.split(" ");
    const isValid = signatures.some((s) => {
      const [, sigValue] = s.split(",");
      return sigValue === expectedSig;
    });

    if (!isValid) {
      return c.json({ error: "Invalid webhook signature" }, 401);
    }

    // Parse the pre-read body
    var body = JSON.parse(rawBody);
  } else {
    // No secret configured — allow in development only
    var body = await c.req.json();
  }

  const { type, data } = body as {
    type: string;
    data: {
      id: string;
      email_addresses: Array<{ email_address: string; id: string }>;
      primary_email_address_id?: string;
      first_name: string | null;
      last_name: string | null;
      image_url: string | null;
      public_metadata?: { role?: string };
    };
  };

  if (type !== "user.created" && type !== "user.updated") {
    // Acknowledge unhandled event types without error
    return c.json({ received: true });
  }

  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  ) ?? data.email_addresses[0];

  if (!primaryEmail) {
    return c.json({ error: "No email address on Clerk user" }, 400);
  }

  const now = Date.now();
  const db = drizzle(c.env.DB);

  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ") || "Unknown";
  // Validate role against allowed values, default to "student"
  const rawRole = data.public_metadata?.role;
  const role: UserRole = USER_ROLES.includes(rawRole as UserRole)
    ? (rawRole as UserRole)
    : "student";

  await db
    .insert(users)
    .values({
      id: data.id,
      email: primaryEmail.email_address,
      name: fullName,
      avatarUrl: data.image_url ?? null,
      role,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: primaryEmail.email_address,
        name: fullName,
        avatarUrl: data.image_url ?? null,
        role,
        updatedAt: now,
      },
    });

  return c.json({ synced: true });
});

export { usersRoute, clerkWebhookRoute };
