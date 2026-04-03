---
title: "AI-Native Question Creation API"
description: "POST /api/questions/ai — markdown frontmatter + bare checkboxes, bulk creation, base64 image, tag auto-create"
status: complete
priority: P2
effort: 6h
tags: [feature, backend, api, ai]
blockedBy: []
blocks: []
created: 2026-04-03
---

# AI-Native Question Creation API — Implementation Plan

**Status: COMPLETE** (Apr 3, 2026)

## Overview

Endpoint `POST /api/questions/ai` accepts markdown with YAML frontmatter. AI sends array of `{content, image?}`, server parses frontmatter metadata + bare checkbox options, uploads base64 images to R2, auto-creates tags by name, stores as standard questions.

## Context

- Brainstorm: [brainstorm-260403-2221-ai-question-api.md](../reports/brainstorm-260403-2221-ai-question-api.md)
- Implementation: Phase 1-3 all complete with 23 unit tests passing
- Code review applied: max lengths, base64 handling, N+1 prevention, tag validation
- Existing question route: `apps/api/src/routes/questions-route.ts`
- Question service: `apps/api/src/services/question-service.ts`
- Upload route (R2): `apps/api/src/routes/upload-route.ts`
- Shared schemas: `packages/shared/src/schemas/index.ts`

## Dependencies

- `js-yaml` package (YAML frontmatter parsing, pure JS, CF Workers compatible) — **INSTALLED**
- Existing: Hono, Drizzle ORM, D1, R2 (`c.env.STORAGE`), Zod, nanoid

## Phases

| Phase | Name | Status | Effort | Files |
|-------|------|--------|--------|-------|
| 1 | [Markdown Parser Service](./phase-01-markdown-parser.md) | Complete | 2h | 2 new |
| 2 | [API Route + Integration](./phase-02-api-route.md) | Complete | 3h | 3 modified, 1 new |
| 3 | [Testing](./phase-03-testing.md) | Complete | 1h | 1 new |

## Dependency Graph

```
Phase 1 (parser) ✓ → Phase 2 (route + integration) ✓ → Phase 3 (testing) ✓
```

All phases sequential and complete — parser built, route integrated, all tests passing.
