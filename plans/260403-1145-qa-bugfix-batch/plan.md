---
title: "QA Bugfix Batch — 9 Issues from Production Testing"
description: "Fix JWT token refresh, missing Settings page, dashboard stats, form validation, assessment wizard, pluralization, and UX polish"
status: complete
priority: P1
effort: 8h
tags: [bugfix, auth, ux, validation]
blockedBy: []
blocks: []
created: 2026-04-03
completed: 2026-04-03
---

# QA Bugfix Batch — Implementation Plan

## Overview

Fix all 9 issues discovered during production QA testing of thayphuc.pages.dev. Issues range from critical (JWT token refresh breaking all writes) to cosmetic (pluralization).

## Phases

| Phase | Name | Status | Effort | Severity |
|-------|------|--------|--------|----------|
| 1 | [JWT Token Refresh & Error UX](./phase-01-jwt-token-refresh.md) | Complete | 2h | CRITICAL |
| 2 | [Settings Page Route](./phase-02-settings-page.md) | Complete | 1h | CRITICAL |
| 3 | [Dashboard Stats API](./phase-03-dashboard-stats.md) | Complete | 2h | HIGH |
| 4 | [Form Validation Feedback](./phase-04-form-validation.md) | Complete | 1.5h | MEDIUM |
| 5 | [Cosmetic & Polish Fixes](./phase-05-cosmetic-fixes.md) | Complete | 0.5h | LOW |

## Dependency Graph

```
Phase 1 (JWT) ← blocks everything, fix first
Phase 2 (Settings) ← independent
Phase 3 (Dashboard Stats) ← needs Phase 1 (API calls require working auth)
Phase 4 (Validation) ← independent
Phase 5 (Cosmetic) ← independent
```

Phases 2, 4, 5 can run in parallel. Phase 3 depends on Phase 1.
