import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { tags } from "../db/schema.js";
import type { Env } from "../env.js";
import { aiCreateQuestionsSchema, type ComplexityType } from "@teaching/shared";
import { generateId } from "../lib/id-generator.js";
import { parseAiQuestion } from "../services/ai-question-parser.js";
import { createQuestion } from "../services/question-service.js";

type Variables = { userId: string };
const aiQuestionRoutes = new Hono<Env & { Variables: Variables }>();

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB decoded
const MAX_NEW_TAGS_PER_REQUEST = 10;

/**
 * Parse a base64 data URI and return the buffer + metadata.
 * Returns null if invalid.
 */
function parseBase64DataUri(dataUri: string): {
  buffer: ArrayBuffer;
  mimeType: string;
  ext: string;
} | { error: string } {
  // Use [\s\S]+ to handle base64 with line breaks
  const match = dataUri.match(/^data:(image\/\w+);base64,([\s\S]+)$/);
  if (!match) {
    return { error: "Invalid base64 data URI. Expected format: data:image/png;base64,..." };
  }

  const mimeType = match[1];
  const ext = ALLOWED_IMAGE_TYPES[mimeType];
  if (!ext) {
    return { error: `Unsupported image type "${mimeType}". Allowed: png, jpg, gif, webp` };
  }

  // Strip whitespace/newlines from base64 payload before decoding
  const encoded = match[2].replace(/\s/g, "");
  const estimatedSize = (encoded.length * 3) / 4;
  if (estimatedSize > MAX_IMAGE_SIZE) {
    return { error: `Image too large (~${Math.round(estimatedSize / 1024 / 1024)}MB). Maximum is 5MB` };
  }

  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    return { error: "Invalid base64 encoding in image data" };
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return { buffer: bytes.buffer, mimeType, ext };
}

/**
 * Replace `![...](image)` placeholder with real URL, or prepend image.
 */
function injectImageUrl(content: string, imageUrl: string): string {
  if (content.includes("](image)")) {
    return content.replace(/\]\(image\)/, `](${imageUrl})`);
  }
  return `![](${imageUrl})\n\n${content}`;
}

/** Shared tag cache: built once per request, updated as new tags are created */
type TagCache = Map<string, string>; // lowercase name → tag ID

async function buildTagCache(
  db: ReturnType<typeof drizzle>,
  teacherId: string,
): Promise<TagCache> {
  const existingTags = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.teacherId, teacherId));

  const cache: TagCache = new Map();
  for (const t of existingTags) {
    cache.set(t.name.toLowerCase(), t.id);
  }
  return cache;
}

/**
 * Resolve tag names to IDs using shared cache. Creates missing tags (up to limit).
 * Validates tag name length (max 50 chars, matching createTagSchema).
 */
async function resolveTagNames(
  db: ReturnType<typeof drizzle>,
  teacherId: string,
  tagNames: string[],
  tagCache: TagCache,
  newTagBudget: { remaining: number },
): Promise<{ tagIds: string[]; tagsCreated: string[]; error?: string }> {
  if (tagNames.length === 0) return { tagIds: [], tagsCreated: [] };

  const tagIds: string[] = [];
  const tagsCreated: string[] = [];

  for (const name of tagNames) {
    if (name.length > 50) {
      return { tagIds, tagsCreated, error: `Tag name "${name.slice(0, 20)}..." exceeds 50 character limit` };
    }

    const lower = name.toLowerCase();
    const existingId = tagCache.get(lower);

    if (existingId) {
      tagIds.push(existingId);
    } else {
      if (newTagBudget.remaining <= 0) {
        return {
          tagIds,
          tagsCreated,
          error: `Exceeded max ${MAX_NEW_TAGS_PER_REQUEST} new tags per request. Tag "${name}" not created.`,
        };
      }

      const id = generateId();
      const now = Date.now();
      await db.insert(tags).values({ id, name, teacherId, color: null, createdAt: now });

      // Update shared cache so subsequent questions see this tag
      tagCache.set(lower, id);
      tagIds.push(id);
      tagsCreated.push(name);
      newTagBudget.remaining--;
    }
  }

  return { tagIds, tagsCreated };
}

// POST / — bulk create questions from AI-generated markdown
aiQuestionRoutes.post("/", async (c) => {
  const teacherId = c.get("userId");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = aiCreateQuestionsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const db = drizzle(c.env.DB);

  // Build tag cache once — shared across all questions to avoid N+1 and duplicates
  const tagCache = await buildTagCache(db, teacherId);

  const results: Array<
    | { id: string; index: number; status: "created" }
    | { index: number; status: "error"; error: string }
  > = [];
  const allTagsCreated: string[] = [];
  const newTagBudget = { remaining: MAX_NEW_TAGS_PER_REQUEST };

  for (let i = 0; i < parsed.data.questions.length; i++) {
    const item = parsed.data.questions[i];

    try {
      // Step 1: Parse markdown
      const parseResult = parseAiQuestion(item.content);
      if (!parseResult.ok) {
        results.push({ index: i, status: "error", error: parseResult.error });
        continue;
      }

      let { content } = parseResult.data;
      const { options, complexity, complexityType, explanation, tagNames } = parseResult.data;

      // Step 2: Upload base64 image if provided
      if (item.image) {
        const imageResult = parseBase64DataUri(item.image);
        if ("error" in imageResult) {
          results.push({ index: i, status: "error", error: imageResult.error });
          continue;
        }

        const key = `images/${generateId()}.${imageResult.ext}`;
        await c.env.STORAGE.put(key, imageResult.buffer, {
          httpMetadata: { contentType: imageResult.mimeType },
        });

        const imageUrl = `/api/upload/image/${key}`;
        content = injectImageUrl(content, imageUrl);
      }

      // Step 3: Resolve tag names → IDs
      const tagResult = await resolveTagNames(db, teacherId, tagNames, tagCache, newTagBudget);
      if (tagResult.error) {
        results.push({ index: i, status: "error", error: tagResult.error });
        continue;
      }
      allTagsCreated.push(...tagResult.tagsCreated);

      // Step 4: Create question via existing service
      const question = await createQuestion(db, teacherId, {
        content,
        options,
        complexity: complexity as 1 | 2 | 3 | 4 | 5,
        complexityType: complexityType as ComplexityType,
        explanation: explanation ?? undefined,
        tagIds: tagResult.tagIds.length > 0 ? tagResult.tagIds : undefined,
      });

      results.push({ id: question.id, index: i, status: "created" });
    } catch (err) {
      results.push({
        index: i,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const failed = results.filter((r) => r.status === "error").length;

  // Deduplicate tagsCreated
  const uniqueTagsCreated = [...new Set(allTagsCreated)];

  return c.json({ created, failed, questions: results, tagsCreated: uniqueTagsCreated });
});

export { aiQuestionRoutes };
