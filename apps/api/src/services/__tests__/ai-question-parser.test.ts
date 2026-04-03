import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  parseCheckboxOptions,
  extractQuestionContent,
  parseAiQuestion,
} from "../ai-question-parser.js";

describe("parseFrontmatter", () => {
  it("extracts YAML frontmatter and body", () => {
    const md = `---
complexity: 3
complexityType: application
---

What is 2+2?

[x] 4
[ ] 5`;
    const result = parseFrontmatter(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frontmatter.complexity).toBe(3);
    expect(result.frontmatter.complexityType).toBe("application");
    expect(result.body).toContain("What is 2+2?");
  });

  it("returns error when no opening --- found", () => {
    const result = parseFrontmatter("no frontmatter here");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("no opening");
  });

  it("returns error when no closing --- found", () => {
    const result = parseFrontmatter("---\ncomplexity: 1\nno closing");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("no closing");
  });

  it("handles invalid YAML gracefully", () => {
    const md = `---
: invalid: yaml: [
---

body`;
    const result = parseFrontmatter(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Invalid YAML");
  });
});

describe("parseCheckboxOptions", () => {
  it("parses correct and incorrect options", () => {
    const body = `Question text

[x] Correct answer
[ ] Wrong answer 1
[ ] Wrong answer 2`;
    const options = parseCheckboxOptions(body);
    expect(options).toHaveLength(3);
    expect(options[0].isCorrect).toBe(true);
    expect(options[0].text).toBe("Correct answer");
    expect(options[1].isCorrect).toBe(false);
    expect(options[2].isCorrect).toBe(false);
  });

  it("handles multiple correct answers", () => {
    const body = `[x] A\n[x] B\n[ ] C`;
    const options = parseCheckboxOptions(body);
    expect(options.filter((o) => o.isCorrect)).toHaveLength(2);
  });

  it("generates unique IDs for each option", () => {
    const body = `[x] A\n[ ] B\n[ ] C`;
    const options = parseCheckboxOptions(body);
    const ids = options.map((o) => o.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("preserves inline markdown in option text", () => {
    const body = `[x] **bold** and $x^2$ math\n[ ] \`code\` option`;
    const options = parseCheckboxOptions(body);
    expect(options[0].text).toBe("**bold** and $x^2$ math");
    expect(options[1].text).toBe("`code` option");
  });

  it("returns empty array when no checkboxes found", () => {
    const options = parseCheckboxOptions("just some text\nno checkboxes");
    expect(options).toHaveLength(0);
  });
});

describe("extractQuestionContent", () => {
  it("extracts text before first checkbox", () => {
    const body = `What is the answer?

![diagram](image)

[x] Yes
[ ] No`;
    expect(extractQuestionContent(body)).toBe("What is the answer?\n\n![diagram](image)");
  });

  it("returns empty string when body starts with checkbox", () => {
    expect(extractQuestionContent("[x] Option")).toBe("");
  });

  it("trims whitespace from content", () => {
    const body = `

  Question text

[x] A`;
    expect(extractQuestionContent(body)).toBe("Question text");
  });
});

describe("parseAiQuestion", () => {
  const validMarkdown = `---
complexity: 3
complexityType: application
tags:
  - algebra
  - math
explanation: |
  The answer is derived from factoring.
---

What is $x^2 + 5x + 6 = 0$?

[x] $x = -2, x = -3$
[ ] $x = 1, x = 6$
[ ] $x = 2, x = 3$
[ ] $x = -1, x = -6$`;

  it("parses valid markdown into structured question", () => {
    const result = parseAiQuestion(validMarkdown);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.complexity).toBe(3);
    expect(result.data.complexityType).toBe("application");
    expect(result.data.tagNames).toEqual(["algebra", "math"]);
    expect(result.data.explanation).toContain("factoring");
    expect(result.data.options).toHaveLength(4);
    expect(result.data.options[0].isCorrect).toBe(true);
    expect(result.data.content).toContain("$x^2 + 5x + 6 = 0$");
  });

  it("errors on missing complexity", () => {
    const md = `---
complexityType: knowledge
---

Q?

[x] A
[ ] B`;
    const result = parseAiQuestion(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("complexity");
    expect(result.error).toContain("1, 2, 3, 4, 5");
  });

  it("errors on invalid complexityType", () => {
    const md = `---
complexity: 1
complexityType: recall
---

Q?

[x] A
[ ] B`;
    const result = parseAiQuestion(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("recall");
    expect(result.error).toContain("knowledge");
  });

  it("errors when fewer than 2 options", () => {
    const md = `---
complexity: 1
complexityType: knowledge
---

Q?

[x] Only one`;
    const result = parseAiQuestion(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("1 option");
    expect(result.error).toContain("minimum is 2");
  });

  it("errors when more than 6 options", () => {
    const options = Array.from({ length: 7 }, (_, i) => `[${i === 0 ? "x" : " "}] Option ${i + 1}`).join("\n");
    const md = `---
complexity: 1
complexityType: knowledge
---

Q?

${options}`;
    const result = parseAiQuestion(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("7 options");
    expect(result.error).toContain("maximum is 6");
  });

  it("errors when no correct answer", () => {
    const md = `---
complexity: 1
complexityType: knowledge
---

Q?

[ ] A
[ ] B`;
    const result = parseAiQuestion(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("at least 1 correct");
  });

  it("errors on empty question body", () => {
    const md = `---
complexity: 1
complexityType: knowledge
---

[x] A
[ ] B`;
    const result = parseAiQuestion(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("empty");
  });

  it("allows all-correct options (multi-answer)", () => {
    const md = `---
complexity: 2
complexityType: comprehension
---

Select all correct.

[x] A
[x] B`;
    const result = parseAiQuestion(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.options.every((o) => o.isCorrect)).toBe(true);
  });

  it("ignores unknown frontmatter keys", () => {
    const md = `---
complexity: 1
complexityType: knowledge
unknownField: hello
anotherOne: 42
---

Q?

[x] A
[ ] B`;
    const result = parseAiQuestion(md);
    expect(result.ok).toBe(true);
  });

  it("handles tags as optional (no tags field)", () => {
    const md = `---
complexity: 1
complexityType: knowledge
---

Q?

[x] A
[ ] B`;
    const result = parseAiQuestion(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.tagNames).toEqual([]);
  });

  it("handles explanation as optional", () => {
    const md = `---
complexity: 1
complexityType: knowledge
---

Q?

[x] A
[ ] B`;
    const result = parseAiQuestion(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.explanation).toBeNull();
  });
});
