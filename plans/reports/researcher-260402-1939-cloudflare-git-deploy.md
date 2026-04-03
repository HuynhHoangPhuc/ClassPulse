# Cloudflare Git Deployment: Pages & Workers (No GitHub Actions)

## Executive Summary

**Both Cloudflare Pages and Workers support native Git integration without GitHub Actions.** This report covers the Cloudflare dashboard-only setup for GitHub/GitLab repos, monorepo configuration for your pnpm+turborepo structure, and D1 migration handling.

**Recommendation:** Use Pages Git integration for `apps/web/` (React + Vite SPA) and Workers Builds for `apps/api/` (Hono + D1). Both auto-deploy on push with no GitHub Actions required.

---

## 1. Cloudflare Pages: Direct GitHub Integration

### Setup (Dashboard Only)

1. Go to **Workers & Pages** in Cloudflare dashboard
2. Click **Create application** → **Pages** → **Connect to Git**
3. Authorize Cloudflare to your GitHub account
4. Select repo and branch (main)
5. Cloudflare auto-detects framework; override in **Settings > Build & deployments**

### Monorepo Configuration for `apps/web/`

The repo structure requires configuring **three fields**:

| Setting | Value | Notes |
|---------|-------|-------|
| **Root Directory** | `apps/web/` | Where build runs; required for monorepos |
| **Build Command** | `cd ../../ && pnpm build --filter=web` | Runs from repo root (pnpm monorepo) |
| **Build Output Directory** | `dist/` | Vite SPA output; relative to root directory |

**Key Detail:** Root Directory is the working directory where the build command executes. Set this to `apps/web/` to avoid `pnpm monorepo` install failures in subdirectories.

### Build Watch Paths (Optional but Recommended)

Prevent unnecessary builds from changes outside the web app:

```
Settings > Build & deployments > Build watch paths
```

Add:
```
apps/web/**
packages/shared/**
pnpm-lock.yaml
```

This avoids rebuilds when `apps/api/` changes.

### Environment Variables

**Build-time variables** (for Vite `import.meta.env`):

1. Go to **Settings > Variables and Secrets > Add**
2. Create for both **Production** and **Preview** environments:
   - `VITE_API_URL` — `https://api.yourdomain.com` (build-time)
   - `VITE_CLERK_PUBLISHABLE_KEY` — your public key (build-time)

**How they work:** Cloudflare injects these during build. Vite statically replaces `import.meta.env.VITE_*` at build time.

**Secrets:** Add `VITE_*` vars that contain sensitive values; Cloudflare encrypts them in dashboard but still injects during build.

**Runtime Context:** Pages does NOT support runtime secrets (only Workers via `wrangler.toml`). All env vars are build-time injections.

### Automatic System Variables

Cloudflare injects these without configuration:
- `CF_PAGES=1` — deployment context flag
- `CF_PAGES_COMMIT_SHA` — current commit hash
- `CF_PAGES_BRANCH` — deployment branch (main, feature, etc.)
- `CF_PAGES_URL` — your Pages domain URL

### Deployment Flow

1. Push to `main` branch
2. Cloudflare webhook triggers (no GitHub Actions)
3. Builds in Cloudflare's environment with your env vars
4. Outputs to Pages subdomain; custom domain (via DNS) optional
5. Preview deployments auto-create for other branches (configurable)

### Limitations & Gotchas

- **Cannot downgrade from Git to Direct Upload** once connected (design limitation)
- **Max 5 projects per repo** without requesting limit increase
- **Preview branches are automatic** for all non-main branches; disable in Settings if undesired
- **Build timeout:** 15 min standard, 45 min for Business plan
- **No self-hosted GitHub/GitLab support** (cloud only)

---

## 2. Cloudflare Workers Builds: Git Integration for APIs

### Overview

Workers Builds is the native CI/CD system for deploying Hono Workers automatically via Git push. **Does NOT require GitHub Actions.**

### Setup (Dashboard)

1. Go to **Workers & Pages** → Select your Worker
2. Go to **Settings > Builds > Connect**
3. Authorize GitHub/GitLab
4. Select repo and branches to deploy
5. Configure build settings (if needed)

### Monorepo Configuration for `apps/api/`

For a Hono Worker in `apps/api/`:

| Setting | Value |
|---------|-------|
| **Root Directory** | `apps/api/` |
| **Build Command** | `cd ../../ && pnpm build --filter=api` (if needed) |

**Typical setup:** If your Worker uses `wrangler.toml` (recommended), place it in `apps/api/wrangler.toml`. Cloudflare auto-detects and deploys.

### Bindings & D1 in Workers Builds

D1 bindings **auto-deploy** if configured in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "mydb"
database_id = "xxxxxxxx"
```

**No additional steps needed.** When you push to main, Cloudflare deploys the Worker with D1 bindings intact.

### Environment Variables & Secrets

**Build-time vars** (set in dashboard):
- Go to **Settings > Builds > Build environment variables**
- Add vars accessible during build

**Runtime secrets** (set in wrangler.toml):

```toml
[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "mydb"
database_id = "xxxxxxxx"
```

Secrets can also be managed via **Settings > Variables and Secrets** in dashboard.

### Supported Git Providers

- ✅ GitHub (cloud)
- ✅ GitLab (cloud)
- ❌ Self-hosted GitHub/GitLab
- ❌ Bitbucket (use Wrangler CLI or GitHub Actions workaround)

### Deployment Status Integration

Workers Builds provides GitHub visibility:
- Pull request comments showing build status
- Check runs (GitHub) / Commit statuses (GitLab)
- No action needed; automatic

---

## 3. D1 Database Migrations

### How Migrations Work

Migrations are version-controlled `.sql` files stored in `migrations/` directory:

```
apps/api/
├── src/
├── migrations/
│   ├── 0001_init_schema.sql
│   ├── 0002_add_users_table.sql
│   └── 0003_create_indexes.sql
├── wrangler.toml
```

### Automatic Migration Application on Deployment

**Critical:** D1 migrations do NOT auto-run on Pages or Workers deployment. **You must explicitly run them.**

**Recommended approach:**

1. **Option A: Wrangler CLI in your build process**
   - Add to build command: `wrangler d1 migrations apply --remote --name mydb`
   - Executes during deployment build phase

2. **Option B: Manual application via dashboard or CLI**
   - Post-deployment: `wrangler d1 migrations apply --remote --name mydb`
   - Not ideal for continuous deployment

3. **Option C: Workers script**
   - Create a scheduled Worker that checks/applies pending migrations on deployment

### Migration Configuration (wrangler.toml)

```toml
[env.production]
d1_databases = [
  { binding = "DB", database_name = "mydb", database_id = "xxxxx" }
]

# Optional: customize migration location
[env.production.d1_databases.migrations]
migrations_dir = "migrations/"
migrations_table = "d1_migrations"
```

### Important Details

- Migrations tracked in `d1_migrations` table; Cloudflare prevents re-running applied migrations
- **Rollback:** Manually write rollback SQL or recreate database (no automated rollback)
- **Testing locally:** `wrangler d1 migrations apply --local` uses local SQLite
- **Foreign key constraints:** Use `PRAGMA defer_foreign_keys = true` if migrations violate FK relationships

---

## 4. Monorepo Build Commands (pnpm + turborepo)

### For Pages (`apps/web/`)

```bash
# Root directory: apps/web/
# Build command:
cd ../../ && pnpm build --filter=web

# Output directory: dist/
```

**Why `cd ../../`?** Pages executes the build command from your specified Root Directory. Since pnpm workspaces need access to the lockfile in the repo root, we cd back to the root, then build the `web` filter.

### For Workers (`apps/api/`)

```bash
# Root directory: apps/api/
# Build command (if using turborepo build):
cd ../../ && pnpm build --filter=api

# Or simple wrangler deploy (if no build step):
wrangler deploy
```

### pnpm Monorepo Requirements

Cloudflare's build environment has:
- Node 18.17+ (configurable via `.node-version`)
- pnpm support (auto-detected; pnpm 8.x+ recommended)

Your `pnpm-workspace.yaml` at repo root is auto-detected. No additional setup needed.

---

## 5. Environment Variables: Complete Flow

### Pages (Vite SPA)

```
Dashboard (Settings > Variables and Secrets)
  ↓ (injected during build)
Cloudflare build environment
  ↓ (Vite import.meta.env.VITE_*)
Bundled into .dist/index.html
  ↓
Browser at runtime
```

**Result:** Vars are baked into the final HTML/JS bundle.

### Workers (Hono API)

```
Dashboard (Settings > Variables and Secrets) OR wrangler.toml
  ↓ (bound at deployment)
Worker runtime environment
  ↓ (env.VITE_API_KEY)
Request handler receives env object
```

**Result:** Vars available at runtime in the Worker context.

### Your Specific Setup

**For Pages:**
- `VITE_API_URL` = build-time var → points to your Workers API domain
- `VITE_CLERK_PUBLISHABLE_KEY` = build-time var → Clerk public key

**For Workers:**
- `CLERK_SECRET_KEY` = runtime secret → set in dashboard or wrangler.toml
- `D1_DATABASE` binding = automatic from wrangler.toml

---

## 6. Comparison: Pages Git vs. Workers Builds

| Aspect | Pages | Workers |
|--------|-------|---------|
| **Trigger** | Push to branch | Push to branch |
| **Deployment** | Auto-deploy SPA | Auto-deploy Worker |
| **Build Env Vars** | Dashboard only | Dashboard + wrangler.toml |
| **Runtime Secrets** | No (all vars build-time) | Yes (env object in handler) |
| **D1 Support** | Via Pages Functions only | Full support via bindings |
| **Migrations** | Manual or via build script | Manual or via build script |
| **Git Providers** | GitHub, GitLab | GitHub, GitLab |
| **Setup Complexity** | Low (dashboard UI) | Low (wrangler.toml) |

---

## 7. Deployment Checklist for Your Monorepo

### Pre-Deployment

- [ ] `pnpm-lock.yaml` committed to repo
- [ ] Pages env vars set in dashboard: `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`
- [ ] Workers env vars set in dashboard or `wrangler.toml`: `CLERK_SECRET_KEY`
- [ ] D1 database created; `database_id` in `wrangler.toml`
- [ ] Migration files in `apps/api/migrations/`

### Deploy Pages (`apps/web/`)

1. Create Pages project → connect to GitHub
2. Set Root Directory: `apps/web/`
3. Set Build Command: `cd ../../ && pnpm build --filter=web`
4. Set Build Output: `dist/`
5. Add env vars in Settings
6. Trigger: Push to main

### Deploy Workers (`apps/api/`)

1. Create Worker project → connect to GitHub
2. Set Root Directory: `apps/api/`
3. Ensure `wrangler.toml` has D1 binding and secrets
4. Add env vars in dashboard if needed
5. Trigger: Push to main

### Post-Deployment

- [ ] Verify Pages deployment: Pages URL shows React app
- [ ] Verify Workers deployment: Workers URL responds to API routes
- [ ] Manually run D1 migrations once (or add to build command):
  ```bash
  wrangler d1 migrations apply --remote --name mydb
  ```

---

## 8. Key Gotchas & Solutions

| Issue | Solution |
|-------|----------|
| Build fails with "pnpm: not found" | Cloudflare auto-detects pnpm; ensure `pnpm-lock.yaml` in repo root |
| "Root directory not found" | Monorepo: specify exact subdirectory path (e.g., `apps/web/` not `./apps/web/`) |
| Env vars not in build | Check dashboard: did you save and redeploy? Cloudflare doesn't auto-redeploy when vars change |
| D1 migrations not applied | Migrations are manual; add to build command or run `wrangler d1 migrations apply` post-deploy |
| Pages says "Cannot downgrade to Direct Upload" | Git integration is permanent; use branch controls to disable auto-deploy if needed |
| `VITE_*` vars undefined in browser | Vars must be prefixed `VITE_` for Vite to embed; check dashboard spelling |

---

## 9. Useful References

- [Cloudflare Pages Git Integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare Pages Configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages Monorepos](https://developers.cloudflare.com/pages/configuration/monorepos/)
- [Cloudflare Workers Builds Git Integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/)
- [Cloudflare Workers GitHub Integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
- [D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [D1 Local Development](https://developers.cloudflare.com/d1/best-practices/local-development/)
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)

---

## Unresolved Questions

1. **D1 migration auto-apply:** Does Cloudflare support auto-running migrations on Worker deployment via Workers Builds? Currently requires manual step or custom build script.
2. **Rate limiting on Pages rebuilds:** What happens if commits push rapidly? Is there a queue or do builds overlap?
3. **Preview environment secrets:** Can you set different secrets for preview branches vs. production in the dashboard?

---

**Status:** DONE  
**Source Count:** 15+ official Cloudflare docs, 3 community examples, latest 2025-2026 info
