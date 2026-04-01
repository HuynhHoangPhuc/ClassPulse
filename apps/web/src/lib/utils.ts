import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes with conflict resolution.
 * Uses clsx for conditional logic and tailwind-merge to deduplicate.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
