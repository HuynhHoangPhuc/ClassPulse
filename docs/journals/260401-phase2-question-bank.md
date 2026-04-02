# Phase 2: Question Bank Feature Complete

**Date**: 2026-04-01 23:32
**Severity**: Medium (bundle size concern)
**Component**: Backend routes, frontend forms, image storage
**Status**: Resolved

## What Happened

Phase 2 shipped with 28 files changed (3.5K insertions): 4 backend services (tags, questions, R2 upload, query helpers), 10 React components (markdown editor, list/grid views, filters, tag selector), and shared schema updates. Typecheck clean. Build succeeds.

## The Brutal Truth

We kept it simple and it worked. The temptation to use fancy libraries (MDXEditor, Shiki) was real, but plain textarea + toolbar shipped faster. Code review saved us: caught 3 security bugs (R2 path traversal, unsafe JSON.parse, atomic tag ops) before commit. Bundle hit 1.15MB due to KaTeX fonts — acceptable now, but watching it.

## Technical Details

**Security fixes:** R2 key prefix validation + `..` guard prevents traversal. Tag replacement now uses `db.batch()` (atomic). Hex color validation via strict regex. JSON.parse wrapped in try/catch before storing options.

**Architecture:** Feature module layout at `apps/web/src/features/questions/`. Question service extracted to keep routes under 200 lines. Cursor pagination chosen over offset (D1-friendly). Rehype-highlight for code syntax (faster than Shiki).

## What We Tried

Initially considered MDXEditor for markdown — dropped it (overkill, larger bundle). Sketched Shiki for syntax highlighting — chose rehype-highlight instead (38KB vs 200KB).

## Root Cause Analysis

Security issues existed because: (1) R2 integration was first-pass (no threat modeling), (2) no validation schema enforcement in route handlers, (3) JSON.parse assumptions on untrusted data. Code review caught them because we enforced review before merge. That worked.

Bundle size grew because KaTeX fonts are embedded. Not a failure — acceptable tradeoff for math rendering. Future phases should code-split if it exceeds 1.5MB.

## Lessons Learned

1. **Simple beats clever**: Plain textarea won. Ship it, refactor later.
2. **Security review mandatory**: Every new I/O path (R2, DB mutations) needs review before commit. Non-negotiable.
3. **Parallel agents scale**: Backend + frontend agents in parallel saved ~6 hours vs sequential.
4. **Bundle awareness matters**: 1.15MB is fine, but need monitoring. Code-split KaTeX/markdown on next phase if size grows.
5. **Feature modules work**: 200-line route limit forced good separation. Keep doing this.

## Next Steps

Phase 3 (search/analytics): Test runner setup is now blocking. Must add before Phase 5 (tests required). Bundle monitoring: track size in CI/CD. Monitor cursor pagination performance with real data volumes.

**Owner**: Blocked on test infrastructure setup.
