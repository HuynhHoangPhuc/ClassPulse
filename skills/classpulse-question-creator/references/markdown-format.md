# ClassPulse Question Markdown Format

## Structure

Each question is a single string combining YAML frontmatter + markdown body.

```
---
complexity: <integer 1-5>
complexityType: <enum string>
tags:
  - TagName1
  - TagName2
explanation: 'Why the correct answer is right'
---

Question text goes here. Can include **markdown formatting**.

Can have multiple paragraphs.

[x] Correct answer text
[ ] Incorrect answer 1
[ ] Incorrect answer 2
[ ] Incorrect answer 3
```

## Frontmatter Fields

| Field | Required | Type | Constraints |
|-------|----------|------|-------------|
| `complexity` | Yes | integer | 1-5 |
| `complexityType` | Yes | string | knowledge, comprehension, application, analysis, synthesis, evaluation |
| `tags` | No | string[] | Max 10 new tags per request, each max 50 chars |
| `explanation` | No | string | Wrap in quotes if contains special YAML chars |

## Complexity Type Values

- `knowledge` — Recall facts, definitions, terms
- `comprehension` — Understand meaning, interpret, paraphrase
- `application` — Apply concepts to new situations, solve problems
- `analysis` — Break down, compare, contrast, find patterns
- `synthesis` — Combine elements to form new whole, design
- `evaluation` — Judge, critique, justify, assess value

## Option Format

- `[x]` marks a correct answer
- `[ ]` marks an incorrect answer
- Minimum 2 options, maximum 6
- At least 1 must be correct (`[x]`)
- Multiple correct answers allowed
- Options must be on separate lines
- Question content is everything between frontmatter end (`---`) and first option (`[x]` or `[ ]`)

## Image Injection

To include an image with a question, add it in the request JSON:

```json
{
  "content": "<markdown>",
  "image": "data:image/png;base64,iVBORw0KGgo..."
}
```

- Supported formats: PNG, JPEG, GIF, WebP
- Max 5MB per image (decoded base64 size)
- Max 7MB total image data per request
- If markdown contains `](image)`, placeholder replaced with uploaded image URL
- Otherwise image prepended to question content

## Example: Single Question

```
---
complexity: 3
complexityType: application
tags:
  - Physics
  - Mechanics
explanation: "Newton's second law states F = ma. With m=5kg and a=3m/s², F = 15N."
---

A 5 kg object accelerates at 3 m/s². What is the net force acting on it?

[x] 15 N
[ ] 8 N
[ ] 2 N
[ ] 30 N
```

## Example: Multiple Correct Answers

```
---
complexity: 4
complexityType: analysis
tags:
  - Chemistry
explanation: 'Both NaCl and KBr are ionic compounds formed by metal + nonmetal bonding.'
---

Which of the following are ionic compounds?

[x] NaCl
[x] KBr
[ ] CO2
[ ] CH4
```

## Common Mistakes

- Missing `---` delimiters around frontmatter
- Using `complexity_type` instead of `complexityType`
- Forgetting to quote explanation strings containing colons
- Putting options on same line: `[x] A [ ] B` (must be separate lines)
- Using `(x)` or `[X]` instead of `[x]`
- Having 0 or 1 options (minimum is 2)
- Having more than 6 options
