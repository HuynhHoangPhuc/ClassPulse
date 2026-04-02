# Project Overview & PDR — Teaching Platform

**Version:** 1.3 (Phase 4 Complete)  
**Last Updated:** 2026-04-01  
**Status:** Assessment Bank & Classroom Features Complete

---

## 1. Executive Summary

Teaching Platform is a SaaS application for educators to create, manage, and grade assessments with real-time student feedback and parent visibility. Built on a modern tech stack (Turborepo, Hono, React 19, Drizzle ORM, Clerk), the platform enables teachers to create question banks, auto-generate assessments, assign to classrooms, and track student performance. Parents can monitor their children's progress with role-based dashboards.

**Target Users:**
- **Teachers** — Create assessments, manage classrooms, grade submissions, view analytics
- **Students** — Take assessments, view results, track progress
- **Parents** — Monitor children's performance, view classroom activity

**Phase 1 Deliverables (Complete):**
- Monorepo scaffolding (Turborepo, pnpm workspaces)
- API foundation (Hono on Cloudflare Workers, Drizzle ORM, SQLite/D1)
- Web frontend (React 19 + Vite, TanStack Router/Query, Tailwind v4)
- Authentication (Clerk JWT + webhooks)
- Database schema (15 tables)
- UI component library (layout, form, data display)
- Code standards & architecture documentation

**Phase 2 Deliverables (Complete):**
- Tag management (CRUD API + UI)
- Question bank (CRUD API + list/grid views, filtering, sorting)
- Markdown editor with live preview (markdown + math rendering)
- Image upload & asset storage
- Question filtering (by tags, complexity, search)
- Bulk question import API
- Form validation schemas (Zod)
- Comprehensive question management UI

**Phase 3 Deliverables (Complete - Assessment Bank):**
- Assessment CRUD API with filtering & pagination
- Assessment creation wizard (3 steps: info, question selection, settings)
- Assessment auto-generation API with AI config
- Assessment preview (student-facing view)
- Assessment duplication/cloning
- Question picker with advanced search & filters
- Auto-generation config UI component
- Assessment list page with sorting/pagination

**Phase 4 Deliverables (Complete - Classroom):**
- Classroom CRUD API (create, read, list, update, delete, archive)
- Classroom member management API (add/remove/role updates)
- Invite code generation & regeneration
- Classroom post/feed API (announcements, assignment posts)
- Post creation with threading
- Comment system with @mention support
- Classroom detail page with 4 tabs (Feed, Members, Assessments, Settings)
- Member management dialog (add students/parents, manage roles)
- Post composer & feed rendering
- Settings tab for classroom configuration

---

## 2. Product Vision

### Mission
Empower educators with intuitive assessment tools that reduce administrative burden, provide instant feedback, and give parents visibility into student progress.

### Core Values
1. **Simplicity** — Easy to use for non-technical teachers
2. **Accuracy** — Automated grading, detailed analytics
3. **Collaboration** — Seamless classroom communication
4. **Transparency** — Parents can track student progress in real-time

### Key Differentiators
- **AI-powered question generation** — Teachers describe a topic, platform generates multiple-choice questions automatically
- **Auto-submit on time limit** — Prevents cheating, fair assessment window
- **Real-time feedback** — Students see results immediately
- **Parent dashboards** — Non-teacher family members track progress without grading responsibility
- **Comment threading** — Rich classroom discussion without leaving the platform

---

## 3. Target Audience & Use Cases

### Primary Users

**Teachers (K-12, Higher Ed)**
- Create reusable question banks by subject/topic
- Generate assessments from templates with auto-question generation
- Assign assessments to multiple classrooms with due dates
- Monitor student submissions, grade essays, provide feedback
- View class analytics (average scores, topic mastery, trend analysis)
- Communicate with students/parents via classroom feed

**Students (K-12, Higher Ed)**
- Join classrooms via invite code
- View assigned assessments with due dates
- Take timed assessments, flag for review
- View results and explanations immediately
- Discuss assessments in comments

**Parents (Family members of students)**
- View child's assessment history and scores
- See classroom assignments and due dates
- Track progress over time (trend graphs)
- Receive notifications of submissions, grades
- Cannot grade or modify assignments

### Use Case Examples

**Scenario 1: Weekly Quiz**
1. Teacher creates 5-question quiz on "Photosynthesis"
2. Assigns to Biology classroom, due Friday 5pm
3. Students take quiz Thursday-Friday (auto-submits at deadline)
4. Teacher reviews results, provides written feedback
5. Parent sees quiz score in dashboard, trend improves
6. Student studies explanations for incorrect answers

**Scenario 2: Generate Assessment from Template**
1. Teacher selects template "Unit 3 Practice Test"
2. Configures: 20 questions, 60% from "Photosynthesis", 40% from "Cellular Respiration"
3. AI generates questions matching criteria
4. Teacher previews, edits one question, approves
5. Assigns to 3 classrooms simultaneously
6. Each classroom takes assessment independently

---

## 4. Functional Requirements (Phase 1-4)

### Phase 1: Foundation (COMPLETE)
- [x] Monorepo setup (Turborepo, workspaces)
- [x] API skeleton (Hono, middleware, routes)
- [x] Database schema (15 tables, relationships)
- [x] Clerk authentication (JWT, webhooks)
- [x] Web shell (sidebar, header, theme toggle)
- [x] Routing structure (TanStack Router, layout)
- [x] UI component library (card, badge, page-header, empty-state)
- [x] Shared types & constants

### Phase 2: Core Assessment Features (COMPLETE)
- [x] Question management (create, edit, delete, filter)
- [x] Question bank UI (search, filter by tags/complexity, sort)
- [x] Tag management (teacher can create custom tags with colors)
- [x] Markdown editor with live preview
- [x] Image upload & rendering in questions
- [x] Bulk question import API (POST /api/questions/bulk)
- [x] API endpoints: Full CRUD for questions and tags
- [x] Form validation schemas (Zod)

### Phase 3: Assessment Bank (COMPLETE)
- [x] Assessment creation wizard (manual question selection + auto-generate option)
- [x] Assessment preview (student-facing view)
- [x] Assessment CRUD API (GET/POST/PUT/DELETE /api/assessments)
- [x] Assessment auto-generation API (POST /api/assessments/generate)
- [x] Assessment duplication (POST /api/assessments/:id/duplicate)
- [x] Assessment filtering & pagination
- [x] Question picker with advanced search
- [x] Auto-gen config UI
- [ ] Assessment taking interface (timer, navigation, flag for review)
- [ ] Auto-submit on time limit
- [ ] Immediate result display (if show_results = "immediately")

### Phase 4: Classroom & Communication (COMPLETE)
- [x] Classroom management (create, invite members, manage roles)
- [x] Classroom feed (announcements, assignment posts)
- [x] Comments & threading (reply to posts, mention @users)
- [x] Member management (add/remove students, parents)
- [x] Invite code generation & sharing
- [x] API endpoints: CRUD for classrooms, posts, comments, members
- [x] Classroom detail page with 4 tabs (Feed, Members, Assessments, Settings)
- [x] Post composer & feed rendering
- [ ] Notifications system (comments, submissions, assignments)
- [ ] WebSocket real-time feed updates

### Phase 4: Advanced Features
- [ ] Parent dashboards (metrics, trend graphs, student selector)
- [ ] Teacher analytics (performance by topic, comparison to class average)
- [ ] AI question generation (OpenAI integration)
- [ ] Manual grading interface (for essay/short-answer questions)
- [ ] Assessment editing with version history
- [ ] Bulk operations (import questions from CSV, bulk assign)
- [ ] Student progress reports (downloadable PDF)
- [ ] WebSocket real-time updates

---

## 5. Non-Functional Requirements

### Performance
- **Page load time:** < 2 seconds (first paint)
- **API response time:** < 200ms (p95) for cached queries
- **Database queries:** < 100ms for typical queries
- **Code split:** Routes lazy-load, bundle size < 200KB (gzipped)

### Scalability
- **Database:** Support 10,000+ users, 100,000+ assessments
- **Concurrent users:** Handle 1,000 simultaneous assessment takers
- **Storage:** SQLite on D1 (scale via Cloudflare), 1GB initial limit

### Reliability
- **Uptime:** 99.9% SLA (Cloudflare Workers)
- **Error handling:** Graceful degradation, no white screens of death
- **Data consistency:** Transactions for multi-step operations (assessment creation, grading)
- **Audit trail:** All user actions logged (created_at, updated_at)

### Security
- **Authentication:** Clerk JWT, webhook verification
- **Authorization:** RBAC (teacher, student, parent roles)
- **Data isolation:** Teachers see only own questions/assessments
- **Input validation:** Zod schemas for all API requests
- **Rate limiting:** 1,000 requests/hour per user (phase 2)
- **HTTPS:** All traffic encrypted in transit
- **Secrets:** No secrets in code, environment variables only

### Accessibility
- **WCAG 2.1 AA:** Minimum compliance for all interfaces
- **Keyboard navigation:** All features operable via keyboard
- **Screen readers:** Semantic HTML, ARIA labels
- **Color contrast:** 4.5:1 minimum for text
- **Motion:** Respect prefers-reduced-motion

### Compatibility
- **Browsers:** Chrome, Firefox, Safari, Edge (latest 2 versions)
- **Devices:** Desktop, tablet, mobile (320px+ width)
- **OS:** Windows, macOS, iOS, Android

---

## 6. Success Metrics

### User Adoption
- **Teachers active:** 100+ within 6 months
- **Students active:** 1,000+ within 6 months
- **Weekly active users:** 30% of registered

### Engagement
- **Assessment completion rate:** 85%+ (students take assigned assessments)
- **Classroom activity:** 1+ post/week average
- **Feature usage:** 70%+ of teachers use question bank, 50%+ use AI generation

### Performance
- **System uptime:** 99.9%
- **Assessment submit time:** < 1 second (99th percentile)
- **Page load time:** < 2 seconds (p95)

### Quality
- **Bug reports:** < 10 per month post-launch
- **Code coverage:** 80%+ for critical paths
- **TypeScript errors:** 0 in production code

---

## 7. Technical Constraints

### Architecture
- Monorepo structure (cannot be split into separate repos in phase 1)
- Hono on Cloudflare Workers (serverless, no persistent connections)
- SQLite (suitable for read-heavy educational platform)
- Single database instance (no sharding until scaling required)

### Tech Stack Lock-In
- **Frontend:** React 19, TanStack Router (migration cost moderate)
- **Backend:** Hono (early adoption, smaller ecosystem than Express)
- **ORM:** Drizzle (newer, fewer resources than Prisma)
- **Database:** D1 (Cloudflare product, lock-in risk)

### Development
- Node 20+ required (EOL Dec 2026, upgrade planning needed)
- pnpm workspaces (different from npm/yarn, team must learn)
- TypeScript strict mode (no escape hatches)

### Deployment
- Cloudflare Workers (max 30-second timeout, no local filesystem)
- D1 database (eventual consistency, not real-time)

---

## 8. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| **Database scaling limit** | Cannot support 100K+ assessments | Medium | Plan D1 sharding or PostgreSQL migration in phase 4 |
| **Clerk dependencies** | Auth outage blocks platform | Low | Implement fallback token validation, monitor Clerk status |
| **AI generation costs** | Token usage expensive | Medium | Implement caching, usage limits, cost monitoring |
| **Teacher adoption** | Low engagement, platform fails | Medium | Conduct UX testing, iterate on question creation UX |
| **Student cheating** | Validity of assessments questioned | Low | Implement tab-switch detection, IP logging, time limits |
| **Data loss** | Assessments/grades corrupted | Low | Backup D1 daily, test restore procedures |
| **Timezone bugs** | Wrong due dates for global users | Medium | Always store UTC, test with multiple timezones |

---

## 9. Roadmap & Release Schedule

### Phase 1: Foundation (COMPLETE)
**Timeline:** Jan-Mar 2026  
**Status:** Done  
**Deliverables:**
- Monorepo + deployment pipeline
- API scaffold + auth
- Web shell + routing
- Database schema (15 tables)
- Documentation

### Phase 2: Core Assessment (COMPLETE)
**Timeline:** Mar-Apr 2026  
**Status:** Done  
**Deliverables:**
- Question CRUD API + bank UI with filters/search
- Tag management with color support
- Markdown editor + math/code rendering
- Image upload & asset storage
- Bulk import API
- Question filtering by tags, complexity, search term
- Form validation via Zod schemas

### Phase 3: Assessment Bank (COMPLETE)
**Timeline:** Apr 2026  
**Status:** Done  
**Deliverables:**
- Assessment CRUD API with filtering & pagination
- 3-step creation wizard UI
- Auto-generation API & config
- Assessment preview page
- Assessment duplication
- Question picker component

### Phase 4: Classroom (COMPLETE)
**Timeline:** Apr 2026  
**Status:** Done  
**Deliverables:**
- Classroom CRUD API
- Member management API
- Invite codes & invite code generation
- Feed & posts API
- Comments & threading API
- Classroom detail page (4 tabs)
- Post composer & feed UI
- Member management dialog

### Phase 5: Assessment Submission & Grading (Aug-Sep 2026)
**Timeline:** 6 weeks  
**Deliverables:**
- Assessment taking interface (timer, navigation, flag for review)
- Auto-submit on time limit
- Immediate result display for auto-graded questions
- Assessment attempt submission & storage
- Answer recording per question
- Student result page with explanations

### Phase 6: Analytics & Parent Dashboards (Oct-Nov 2026)
**Timeline:** 6 weeks  
**Deliverables:**
- Parent dashboards (metrics, trend graphs, student selector)
- Teacher analytics (performance by topic, comparison to class average)
- Manual grading interface (for essay/short-answer questions)
- Student progress reports (downloadable PDF)
- Notification system (comments, submissions, assignments)

### Phase 7: Advanced Features & Launch (Dec 2026)
**Timeline:** 8 weeks  
**Deliverables:**
- AI question generation (OpenAI integration)
- WebSocket real-time updates
- Assessment editing with version history
- Bulk operations (import questions from CSV, bulk assign)
- Security audit
- Performance optimization
- Load testing
- User acceptance testing
- Launch marketing
- Customer support setup

---

## 10. Dependencies & External Services

### Mandatory
- **Cloudflare Workers** — API hosting (no alternative, architecture locked)
- **Cloudflare D1** — Database (migration cost high)
- **Clerk** — Authentication (moderate switching cost)

### Planned
- **OpenAI API** — AI question generation (can use alternatives: Anthropic, Google)
- **Recharts** — Data visualization (alternatives: Visx, Plotly)

### Optional (Phase 3+)
- **Slack integration** — Post class announcements to Slack
- **Google Classroom sync** — Import assignments from GC
- **Webhook integrations** — Trigger external workflows

---

## 11. Definition of Done

### Code
- [ ] All tests passing (unit + integration)
- [ ] No TypeScript errors or ESLint warnings
- [ ] Code reviewed by at least one peer
- [ ] Documentation updated (README, API docs, code comments)

### Features
- [ ] All acceptance criteria met
- [ ] Edge cases handled
- [ ] Error states tested
- [ ] Accessibility checked (keyboard nav, color contrast, ARIA)

### Deployment
- [ ] Built and deployed to staging
- [ ] E2E tests passing on staging
- [ ] Performance metrics within target
- [ ] Security audit passed (if applicable)

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| **Assessment** | A timed quiz/test assigned to a classroom with scoring rules |
| **Question** | Individual MCQ with options, complexity level, explanation |
| **Classroom** | Virtual group of students + teacher(s) + parent(s) |
| **Tag** | User-defined label for categorizing questions (e.g., "Photosynthesis") |
| **Attempt** | Student's submission of an assessment with answers and score |
| **Post** | Feed item in classroom (announcement or assessment assignment) |
| **Auto-Submit** | Assessment automatically submitted when timer expires |
| **Tab-Switch Detection** | Flag when student leaves assessment tab (prevents cheating) |
| **Parent Detail View** | Configurable access level for parents (scores-only vs full breakdown) |
| **Generation Config** | AI parameters for auto-generating questions (count, distribution, etc.) |

---

## 13. Related Documents
- [`code-standards.md`](./code-standards.md) — Coding conventions & patterns
- [`system-architecture.md`](./system-architecture.md) — Technical architecture
- [`design-guidelines.md`](./design-guidelines.md) — UI/UX design system
