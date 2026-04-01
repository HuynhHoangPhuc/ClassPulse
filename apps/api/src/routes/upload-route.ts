import { Hono } from "hono";
import type { Env } from "../env.js";
import { generateId } from "../lib/id-generator.js";

type Variables = { userId: string };

const uploadRoute = new Hono<Env & { Variables: Variables }>();

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// POST / — upload image to R2
uploadRoute.post("/", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || typeof file === "string") {
    return c.json({ error: "No file uploaded" }, 400);
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return c.json({ error: "Invalid file type. Allowed: png, jpg, gif, webp" }, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: "File too large. Maximum size is 5MB" }, 400);
  }

  const ext = MIME_TO_EXT[file.type];
  const key = `images/${generateId()}.${ext}`;

  await c.env.STORAGE.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  return c.json({ url: `/api/upload/image/${key}` }, 201);
});

// GET /:key{.+} — serve image from R2 (restricted to images/ prefix)
uploadRoute.get("/:key{.+}", async (c) => {
  const key = c.req.param("key");

  // Prevent path traversal — only serve from images/ prefix
  if (!key.startsWith("images/") || key.includes("..")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const object = await c.env.STORAGE.get(key);

  if (!object) {
    return c.json({ error: "Image not found" }, 404);
  }

  const contentType = object.httpMetadata?.contentType ?? "application/octet-stream";
  return new Response(object.body, {
    headers: { "Content-Type": contentType },
  });
});

export { uploadRoute };
