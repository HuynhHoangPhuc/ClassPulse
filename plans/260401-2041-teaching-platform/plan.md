---
title: "Teaching Platform"
description: "Web-based teaching platform with question bank, assessment auto-generation, classrooms, real-time notifications, and parent dashboard on Cloudflare free tier"
status: complete
priority: P1
effort: 80h
tags: [feature, fullstack, cloudflare, education]
blockedBy: []
blocks: []
created: 2026-04-01
---

# Teaching Platform — Implementation Plan

## Overview

Build multi-role (teacher/student/parent) teaching platform. Hono API on CF Workers + React SPA on CF Pages. D1 database, R2 storage, Durable Objects for real-time. Clerk auth (Google login). Turborepo monorepo. All Cloudflare free tier.

## Context

- Brainstorm: [brainstorm-260401-1835-teaching-platform.md](../reports/brainstorm-260401-1835-teaching-platform.md)
- Design: [design-guidelines.md](../../docs/design-guidelines.md)

## Dependencies

- Cloudflare account (free tier)
- Clerk account (free tier, 50K MAU)
- Node.js 20+, pnpm 9+

## Phases

| Phase | Name | Status | Effort | Depends On |
|-------|------|--------|--------|------------|
| 1 | [Foundation & Project Setup](./phase-01-foundation.md) | Complete | 12h | — |
| 2 | [Question Bank](./phase-02-question-bank.md) | Complete | 12h | Phase 1 |
| 3 | [Assessment Bank](./phase-03-assessment-bank.md) | Complete | 12h | Phase 2 |
| 4 | [Classroom](./phase-04-classroom.md) | Complete | 10h | Phase 1 |
| 5 | [Assessment Taking](./phase-05-assessment-taking.md) | Complete | 10h | Phase 3, 4 |
| 6 | [Comments & Mentions](./phase-06-comments-mentions.md) | Complete | 8h | Phase 4 |
| 7 | [Real-time Notifications](./phase-07-realtime-notifications.md) | Complete | 8h | Phase 6 |
| 8 | [Parent Dashboard](./phase-08-parent-dashboard.md) | Complete | 8h | Phase 5 |

## Dependency Graph

```
Phase 1 (Foundation)
├── Phase 2 (Question Bank)
│   └── Phase 3 (Assessment Bank)
│       └── Phase 5 (Assessment Taking) ← also needs Phase 4
├── Phase 4 (Classroom)
│   ├── Phase 5 (Assessment Taking)
│   └── Phase 6 (Comments & Mentions)
│       └── Phase 7 (Real-time Notifications)
└── Phase 8 (Parent Dashboard) ← needs Phase 5
```

## Architecture Summary

```
┌─────────────────────────────┐
│  Cloudflare Pages (SPA)     │
│  React 19 + Vite            │
│  TanStack Router/Query      │
│  Tailwind v4 + shadcn/ui    │
│  Clerk React SDK            │
└──────────────┬──────────────┘
               │ Hono RPC (type-safe)
┌──────────────▼──────────────┐
│  Cloudflare Workers (API)   │
│  Hono + Drizzle ORM + Zod  │
│  Clerk Backend SDK          │
└──┬────────┬────────┬────────┘
   │        │        │
┌──▼──┐  ┌──▼──┐  ┌──▼───────────┐
│ D1  │  │ R2  │  │ Durable Obj  │
│(DB) │  │(img)│  │ (WebSocket)  │
└─────┘  └─────┘  └──────────────┘
```
