# ClassPulse API Reference

## Authentication

All requests require: `Authorization: Bearer <token>`

Token is either:
- Clerk JWT session token (full access)
- Clerk API key with `ai:questions:write` scope (for AI endpoints)

## POST /api/questions/ai

Bulk create questions from AI-generated markdown.

**Request:**
```json
{
  "questions": [
    {
      "content": "---\ncomplexity: 2\ncomplexityType: comprehension\ntags:\n  - Biology\nexplanation: 'Photosynthesis converts light to chemical energy'\n---\n\nWhat is photosynthesis?\n\n[x] Process of making food from sunlight\n[ ] Process of eating food",
      "image": "data:image/png;base64,..."
    }
  ]
}
```

**Constraints:**
- Max 50 questions per request
- Max 10 new tags per request
- Max 5MB per image, 7MB total image data
- Tag names max 50 characters

**Response (200):**
```json
{
  "created": 2,
  "failed": 0,
  "questions": [
    { "id": "q_abc", "index": 0, "status": "created" },
    { "id": "q_def", "index": 1, "status": "created" }
  ],
  "tagsCreated": ["Biology"]
}
```

**Partial failure response (200):**
```json
{
  "created": 1,
  "failed": 1,
  "questions": [
    { "id": "q_abc", "index": 0, "status": "created" },
    { "index": 1, "status": "error", "error": "Found 1 option(s), minimum is 2" }
  ],
  "tagsCreated": []
}
```

## GET /api/tags

List all tags for authenticated teacher.

**Response (200):**
```json
[
  { "id": "tag_1", "name": "Biology", "color": "#10B981", "createdAt": 1700000000000 },
  { "id": "tag_2", "name": "Physics", "color": "#F59E0B", "createdAt": 1700000000001 }
]
```

## GET /api/questions

List questions with cursor pagination and filters.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 20 | 1-50 |
| `cursor` | string | — | Question ID for pagination |
| `search` | string | — | Search content text |
| `complexityMin` | number | — | 1-5 |
| `complexityMax` | number | — | 1-5 |
| `complexityType` | string | — | Bloom's taxonomy enum |
| `tagIds` | string | — | Comma-separated tag IDs |

**Response (200):**
```json
{
  "items": [
    {
      "id": "q_xyz",
      "content": "What is 2+2?",
      "options": [
        { "id": "opt_1", "text": "4", "isCorrect": true },
        { "id": "opt_2", "text": "5", "isCorrect": false }
      ],
      "complexity": 1,
      "complexityType": "knowledge",
      "explanation": "Basic arithmetic",
      "tags": [{ "id": "tag_1", "name": "Math", "color": "#10B981" }],
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    }
  ],
  "nextCursor": "q_next_id"
}
```

## Error Responses

All errors follow:
```json
{
  "error": "Error message",
  "details": { "formErrors": {}, "fieldErrors": {} }
}
```

| Code | Meaning |
|------|---------|
| 400 | Invalid input / validation failure |
| 401 | Missing or invalid authentication |
| 403 | Insufficient permissions or scope |
| 404 | Resource not found |
| 500 | Server error |
