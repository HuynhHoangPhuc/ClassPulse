import { nanoid } from "nanoid";

/**
 * Generates a URL-safe unique ID using nanoid.
 * @param size - character length of the ID (default: 21)
 */
export function generateId(size = 21): string {
  return nanoid(size);
}
