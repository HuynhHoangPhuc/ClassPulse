# ClassPulse

A monorepo-based SaaS platform for educators to create, manage, and grade assessments with real-time student feedback and parent visibility.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm |
| API | Hono (Cloudflare Workers + Durable Objects) |
| Database | Drizzle ORM + SQLite/D1 |
| Auth | Clerk (JWT + API Keys + Webhooks) |
| Web | React 19 + Vite |
| Router | TanStack Router (code-based) |
| State | TanStack Query |
| Styling | Tailwind CSS v4 |
| Validation | Zod |
| Testing | Vitest |

## Project Structure

```
ClassPulse/
├── apps/
│   ├── api/          # Hono REST API backend
│   └── web/          # React 19 + Vite frontend
├── packages/
│   └── shared/       # TypeScript types, constants, Zod schemas
├── skills/           # External AI agent skills
├── docs/             # Project documentation
└── plans/            # Development plans & reports
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm 9.15.0+

### Setup

```bash
pnpm install       # Install workspace dependencies
pnpm run dev       # Start API (Wrangler) + Web (Vite)
pnpm run build     # Build all apps
pnpm run lint      # Lint code
pnpm run typecheck # Type-check all packages
```

### Environment

The API runs on Cloudflare Workers locally via Wrangler. See `apps/api/wrangler.toml` for D1 database bindings and environment configuration.

Auth is handled by Clerk. Set up Clerk environment variables in your local `.dev.vars` or `.env` files as required by each app.

## Features

### Question Bank
- CRUD for multiple-choice questions with markdown support (LaTeX, code highlighting)
- Tag management with color labels
- Bloom's Taxonomy complexity levels (1-5)
- Bulk import/export
- AI-powered question creation via markdown frontmatter (`POST /api/questions/ai`)

### Assessment Management
- 3-step creation wizard (info, question selection, settings)
- Auto-generation with AI config (sample by tag/complexity)
- Assessment duplication and preview
- Timed assessment taking with anti-cheat tab-switch detection
- Auto-save, seeded shuffle, custom scoring with penalties
- Immediate score display and teacher submission viewer

### Classrooms
- Classroom creation with invite codes
- Member management (teacher/student/parent roles)
- Feed with announcements and assessment assignments
- Threaded comments with @mention support

### Real-time Notifications
- WebSocket connections via Durable Objects (per-classroom)
- Bell icon with unread badge, dropdown panel, toast alerts
- Auto-reconnect with exponential backoff

### Parent Dashboard
- Student selector for linked children
- Score gauge, 30-day trend chart, per-tag performance
- Activity feed and paginated assessment history

### AI Agent Integration
- `POST /api/questions/ai` — Bulk create questions from markdown with YAML frontmatter
- API key auth with `ai:questions:write` scope
- Auto-creates missing tags, supports base64 image upload
- Agent skill available at `skills/classpulse-question-creator/` for Claude Code integration

## API Authentication

Two authentication methods:

1. **JWT Sessions** (Clerk) — Browser-based clients, full role-based access
2. **API Keys** (Clerk) — Third-party integrations, scope-restricted (`ai:questions:write`)

Both use `Authorization: Bearer <token>` header.

## Documentation

- [System Architecture](docs/system-architecture.md)
- [Code Standards](docs/code-standards.md)
- [Codebase Summary](docs/codebase-summary.md)
- [Design Guidelines](docs/design-guidelines.md)
- [Project Overview (PDR)](docs/project-overview-pdr.md)

## License

Private
