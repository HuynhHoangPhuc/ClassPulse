import yaml from "js-yaml";
import { generateId } from "../lib/id-generator.js";
import { COMPLEXITY_TYPES } from "@teaching/shared";

const VALID_COMPLEXITY_TYPES = COMPLEXITY_TYPES as readonly string[];

/** Result types for the parser */
export type ParsedOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type ParsedQuestion = {
  content: string;
  options: ParsedOption[];
  complexity: number;
  complexityType: string;
  explanation: string | null;
  tagNames: string[];
};

export type ParseResult =
  | { ok: true; data: ParsedQuestion }
  | { ok: false; error: string };

/**
 * Extract YAML frontmatter and body from markdown string.
 * Only matches the first two `---` delimiters at line start.
 */
export function parseFrontmatter(markdown: string): {
  ok: true;
  frontmatter: Record<string, unknown>;
  body: string;
} | { ok: false; error: string } {
  const lines = markdown.split("\n");

  // Find first `---` at line start
  const firstIdx = lines.findIndex((l) => l.trim() === "---");
  if (firstIdx === -1) {
    return { ok: false, error: "Missing YAML frontmatter (no opening `---` found)" };
  }

  // Find second `---` after first
  const secondIdx = lines.findIndex((l, i) => i > firstIdx && l.trim() === "---");
  if (secondIdx === -1) {
    return { ok: false, error: "Missing YAML frontmatter (no closing `---` found)" };
  }

  const yamlBlock = lines.slice(firstIdx + 1, secondIdx).join("\n");
  const body = lines.slice(secondIdx + 1).join("\n").trim();

  try {
    const parsed = yaml.load(yamlBlock);
    if (typeof parsed !== "object" || parsed === null) {
      return { ok: false, error: "Frontmatter must be a YAML object" };
    }
    return { ok: true, frontmatter: parsed as Record<string, unknown>, body };
  } catch (e) {
    return { ok: false, error: `Invalid YAML in frontmatter: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Checkbox line regex: `[x]` or `[ ]` followed by text */
const CHECKBOX_REGEX = /^\[( |x)\]\s+(.+)$/;

/**
 * Parse checkbox options from body text.
 * Returns array of options with generated IDs.
 */
export function parseCheckboxOptions(body: string): ParsedOption[] {
  const options: ParsedOption[] = [];
  for (const line of body.split("\n")) {
    const match = line.trim().match(CHECKBOX_REGEX);
    if (match) {
      options.push({
        id: generateId(8),
        text: match[2].trim(),
        isCorrect: match[1] === "x",
      });
    }
  }
  return options;
}

/**
 * Extract question content: everything before the first checkbox line, trimmed.
 */
export function extractQuestionContent(body: string): string {
  const lines = body.split("\n");
  const contentLines: string[] = [];

  for (const line of lines) {
    if (CHECKBOX_REGEX.test(line.trim())) break;
    contentLines.push(line);
  }

  return contentLines.join("\n").trim();
}

/**
 * Validate frontmatter fields against expected types/values.
 */
function validateFrontmatter(fm: Record<string, unknown>): {
  ok: true;
  complexity: number;
  complexityType: string;
  explanation: string | null;
  tagNames: string[];
} | { ok: false; error: string } {
  // complexity: required, integer 1-5
  if (fm.complexity === undefined) {
    return { ok: false, error: "Missing required field `complexity` in frontmatter. Valid values: 1, 2, 3, 4, 5" };
  }
  const complexity = Number(fm.complexity);
  if (!Number.isInteger(complexity) || complexity < 1 || complexity > 5) {
    return { ok: false, error: `Invalid complexity "${fm.complexity}". Must be integer 1-5` };
  }

  // complexityType: required, one of Bloom's values
  if (fm.complexityType === undefined) {
    return {
      ok: false,
      error: `Missing required field \`complexityType\` in frontmatter. Valid values: ${VALID_COMPLEXITY_TYPES.join(", ")}`,
    };
  }
  const complexityType = String(fm.complexityType).toLowerCase();
  if (!VALID_COMPLEXITY_TYPES.includes(complexityType)) {
    return {
      ok: false,
      error: `Invalid complexityType "${fm.complexityType}". Valid values: ${VALID_COMPLEXITY_TYPES.join(", ")}`,
    };
  }

  // tags: optional string array
  let tagNames: string[] = [];
  if (fm.tags !== undefined) {
    if (!Array.isArray(fm.tags)) {
      return { ok: false, error: "Field `tags` must be an array of strings" };
    }
    tagNames = fm.tags.map((t) => String(t).trim()).filter(Boolean);
  }

  // explanation: optional string
  const explanation = fm.explanation !== undefined ? String(fm.explanation).trim() || null : null;

  return { ok: true, complexity, complexityType, explanation, tagNames };
}

/**
 * Main entry: parse a single AI-generated markdown question.
 * Returns structured data matching CreateQuestionInput shape, or an error.
 */
export function parseAiQuestion(content: string): ParseResult {
  // Step 1: Extract frontmatter
  const fmResult = parseFrontmatter(content);
  if (!fmResult.ok) return fmResult;

  // Step 2: Validate frontmatter fields
  const validation = validateFrontmatter(fmResult.frontmatter);
  if (!validation.ok) return validation;

  // Step 3: Extract question content (text before checkboxes)
  const questionContent = extractQuestionContent(fmResult.body);
  if (!questionContent) {
    return { ok: false, error: "Question body is empty (no text found before checkbox options)" };
  }

  // Step 4: Parse checkbox options
  const options = parseCheckboxOptions(fmResult.body);
  if (options.length < 2) {
    return { ok: false, error: `Found ${options.length} option(s), minimum is 2. Use [x] for correct and [ ] for incorrect` };
  }
  if (options.length > 6) {
    return { ok: false, error: `Found ${options.length} options, maximum is 6` };
  }

  const hasCorrect = options.some((o) => o.isCorrect);
  if (!hasCorrect) {
    return { ok: false, error: "Options must have at least 1 correct answer (marked with [x])" };
  }

  return {
    ok: true,
    data: {
      content: questionContent,
      options,
      complexity: validation.complexity,
      complexityType: validation.complexityType,
      explanation: validation.explanation,
      tagNames: validation.tagNames,
    },
  };
}
