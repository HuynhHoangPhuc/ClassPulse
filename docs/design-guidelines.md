# Design Guidelines — Teaching Platform

**Style**: Vibrant Academic — Bento Grid + Glassmorphism touches + energetic Gen Z accents
**Philosophy**: Professional at core, energetic at surface. Clean data-first layouts with vibrant gradient accents, frosted glass cards, and smooth micro-interactions. Think: Notion's clarity meets Duolingo's energy.

---

## 1. Color System

### Light Mode (Default)

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#6366F1` (Indigo 500) | Buttons, links, active states, teacher accent |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--secondary` | `#8B5CF6` (Violet 500) | Secondary actions, parent accent |
| `--secondary-foreground` | `#FFFFFF` | Text on secondary |
| `--accent` | `#F97316` (Orange 500) | CTAs, badges, notifications, energy pops |
| `--accent-foreground` | `#FFFFFF` | Text on accent |
| `--background` | `#FAFAFE` | Page background |
| `--foreground` | `#0F172A` (Slate 900) | Primary text |
| `--card` | `#FFFFFF` | Card backgrounds |
| `--card-foreground` | `#0F172A` | Card text |
| `--muted` | `#F1F5F9` (Slate 100) | Muted backgrounds, input bg |
| `--muted-foreground` | `#64748B` (Slate 500) | Secondary text, placeholders |
| `--border` | `#E2E8F0` (Slate 200) | Borders, dividers |
| `--ring` | `#6366F1` | Focus rings |
| `--destructive` | `#EF4444` (Red 500) | Delete, errors, incorrect answers |
| `--destructive-foreground` | `#FFFFFF` | Text on destructive |
| `--success` | `#10B981` (Emerald 500) | Correct answers, positive metrics |
| `--warning` | `#F59E0B` (Amber 500) | Warnings, approaching deadline |
| `--info` | `#06B6D4` (Cyan 500) | Info badges, student accent |

### Dark Mode

| Token | Hex | Notes |
|-------|-----|-------|
| `--primary` | `#818CF8` (Indigo 400) | Lighter for dark bg contrast |
| `--secondary` | `#A78BFA` (Violet 400) | Desaturated |
| `--accent` | `#FB923C` (Orange 400) | Lighter orange |
| `--background` | `#0B0F1A` | Deep dark, not pure black (avoids OLED smear) |
| `--foreground` | `#F8FAFC` (Slate 50) | Primary text |
| `--card` | `#151A2D` | Elevated surface |
| `--card-foreground` | `#F1F5F9` | Card text |
| `--muted` | `#1E293B` (Slate 800) | Muted bg |
| `--muted-foreground` | `#94A3B8` (Slate 400) | Secondary text |
| `--border` | `rgba(255,255,255,0.08)` | Subtle borders |

### Role-Specific Accents

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Teacher | Indigo | `#6366F1` | Teacher dashboard accents, nav indicator |
| Student | Cyan | `#06B6D4` | Student view accents, progress bars |
| Parent | Violet | `#8B5CF6` | Parent dashboard accents, metric cards |

### Gradient Tokens (Gen Z Energy)

```css
/* Hero/feature gradients */
--gradient-primary: linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%);
--gradient-energy: linear-gradient(135deg, #F97316 0%, #F43F5E 100%);
--gradient-cool: linear-gradient(135deg, #06B6D4 0%, #6366F1 100%);
--gradient-success: linear-gradient(135deg, #10B981 0%, #06B6D4 100%);

/* Card accent stripe (top border gradient) */
--gradient-card-accent: linear-gradient(90deg, #6366F1, #8B5CF6, #EC4899);

/* Ambient background blob (subtle, animated) */
--gradient-blob: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%);
```

### Complexity Level Colors

| Level | Color | Hex |
|-------|-------|-----|
| 1 (Easy) | Green | `#10B981` |
| 2 (Medium-Easy) | Teal | `#14B8A6` |
| 3 (Medium) | Amber | `#F59E0B` |
| 4 (Medium-Hard) | Orange | `#F97316` |
| 5 (Hard) | Rose | `#F43F5E` |

---

## 2. Typography

### Font Stack

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| Heading | **Outfit** | 500, 600, 700, 800 | Page titles, section headers, card titles |
| Body | **Inter** | 300, 400, 500, 600 | Body text, labels, inputs, descriptions |
| Code | **JetBrains Mono** | 400, 500, 600 | Code blocks, inline code in questions |

**Tailwind config:**
```js
fontFamily: {
  heading: ['Outfit', 'sans-serif'],
  sans: ['Inter', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
}
```

### Type Scale

| Name | Size | Weight | Line Height | Letter Spacing | Usage |
|------|------|--------|-------------|----------------|-------|
| `display` | 36px | 800 (Outfit) | 1.1 | -0.02em | Hero headings, empty states |
| `h1` | 30px | 700 (Outfit) | 1.2 | -0.02em | Page titles |
| `h2` | 24px | 600 (Outfit) | 1.3 | -0.01em | Section headers |
| `h3` | 20px | 600 (Outfit) | 1.4 | -0.01em | Card titles, modal titles |
| `h4` | 16px | 600 (Outfit) | 1.4 | 0 | Subsection headers |
| `body-lg` | 16px | 400 (Inter) | 1.6 | 0 | Primary body text |
| `body` | 14px | 400 (Inter) | 1.5 | 0 | Secondary body text, descriptions |
| `body-sm` | 13px | 400 (Inter) | 1.5 | 0 | Helper text, timestamps |
| `caption` | 12px | 500 (Inter) | 1.4 | 0.01em | Labels, badges, metadata |
| `code` | 14px | 400 (JetBrains Mono) | 1.6 | 0 | Code blocks |
| `metric` | 32px | 700 (Outfit) | 1.1 | -0.02em | Dashboard KPI numbers |

### Typography Rules

- Body text minimum 14px (no smaller than 12px for captions)
- Line length: 60-75 characters max for readability
- Use `tabular-nums` for metrics, scores, timers, counts
- Headings always use Outfit font family
- Never use font-weight below 400 for body text

---

## 3. Spacing & Layout

### Spacing Scale (4px base)

| Token | Value | Usage |
|-------|-------|-------|
| `space-0.5` | 2px | Tight inline spacing |
| `space-1` | 4px | Badge padding, tight gaps |
| `space-2` | 8px | Icon-text gap, compact padding |
| `space-3` | 12px | Card inner padding (compact), input padding |
| `space-4` | 16px | Default card padding, section gap |
| `space-5` | 20px | Medium section gap |
| `space-6` | 24px | Card padding (standard), component gap |
| `space-8` | 32px | Section spacing |
| `space-10` | 40px | Large section spacing |
| `space-12` | 48px | Page section dividers |
| `space-16` | 64px | Major section breaks |

### Breakpoints

| Name | Width | Columns | Gutter | Target |
|------|-------|---------|--------|--------|
| `sm` | 640px | 4 | 16px | Small phones |
| `md` | 768px | 8 | 20px | Tablets portrait |
| `lg` | 1024px | 12 | 24px | Tablets landscape, small laptops |
| `xl` | 1280px | 12 | 24px | Desktops |
| `2xl` | 1440px | 12 | 32px | Large desktops |

### Layout Tokens

```css
--sidebar-width: 256px;          /* Expanded sidebar */
--sidebar-width-collapsed: 72px; /* Collapsed sidebar (icon only) */
--header-height: 64px;           /* Top header bar */
--content-max-width: 1200px;     /* Max content width */
--card-radius: 16px;             /* Card border radius */
--button-radius: 12px;           /* Button border radius */
--input-radius: 10px;            /* Input border radius */
--badge-radius: 8px;             /* Badge/tag border radius */
```

### Z-Index Scale

| Layer | Value | Usage |
|-------|-------|-------|
| `base` | 0 | Default content |
| `dropdown` | 10 | Dropdowns, popovers |
| `sticky` | 20 | Sticky headers |
| `sidebar` | 30 | Sidebar navigation |
| `modal-backdrop` | 40 | Modal overlay |
| `modal` | 50 | Modal content |
| `toast` | 60 | Toast notifications |
| `tooltip` | 70 | Tooltips |
| `command` | 100 | Command palette |

---

## 4. Component Patterns

### Cards (Bento Style)

Cards are the primary content container. Use glassmorphism for elevated cards.

```
Standard Card:
- bg: var(--card), border: 1px solid var(--border)
- border-radius: 16px, padding: 24px
- shadow: 0 1px 3px rgba(0,0,0,0.04)
- hover: shadow 0 4px 12px rgba(0,0,0,0.08), translateY(-1px)
- transition: all 200ms ease-out

Glass Card (elevated, modals, floating):
- bg: rgba(255,255,255,0.7) [light] / rgba(21,26,45,0.7) [dark]
- backdrop-filter: blur(16px)
- border: 1px solid rgba(255,255,255,0.2)
- border-radius: 16px

Accent Card (featured items):
- Standard card + gradient top border (3px)
- border-top: 3px solid transparent
- border-image: var(--gradient-card-accent) 1
```

### Bento Grid Dashboard Layout

```
Desktop (xl+): 4-column bento grid
┌──────────┬──────────┬──────────────────────┐
│  KPI 1   │  KPI 2   │   KPI 3 (2x wide)   │
│  1x1     │  1x1     │   2x1                │
├──────────┴──────────┼──────────┬───────────┤
│  Chart (2x tall)    │ Activity │ Upcoming  │
│  2x2                │  1x1     │  1x1      │
│                     ├──────────┴───────────┤
│                     │  Recent (2x wide)    │
└─────────────────────┴─────────────────────┘

Tablet (md): 2-column grid, cards stack
Mobile (sm): 1-column stack
```

### Buttons

| Variant | Style | Usage |
|---------|-------|-------|
| Primary | `bg: var(--primary)`, solid, bold shadow | Main actions (Save, Create, Submit) |
| Secondary | `bg: var(--muted)`, subtle | Cancel, secondary actions |
| Accent | `bg: var(--gradient-energy)`, gradient | CTA highlights (Start Assessment) |
| Ghost | transparent, text only | Tertiary actions, nav items |
| Destructive | `bg: var(--destructive)` | Delete, remove |
| Outline | border only, transparent bg | Toggle, filter buttons |

**Button sizing:**

| Size | Height | Padding | Font | Radius |
|------|--------|---------|------|--------|
| sm | 32px | 12px 16px | 13px/500 | 8px |
| md | 40px | 12px 20px | 14px/500 | 10px |
| lg | 48px | 16px 24px | 16px/600 | 12px |

**Interaction states:**
- Hover: brightness(1.05), slight scale(1.01)
- Active/pressed: brightness(0.95), scale(0.99)
- Focus: 2px ring offset-2 var(--ring)
- Disabled: opacity 0.5, cursor not-allowed
- Loading: spinner + disabled

### Tags/Badges

```
Question Tags:
- bg: pastel tint of tag color (10% opacity)
- text: tag color at 700 shade
- border-radius: 8px
- padding: 4px 10px
- font: caption (12px/500)
- hover: bg opacity increases to 20%

Complexity Badges:
- bg: complexity color (see §1)
- text: white
- border-radius: 20px (pill)
- padding: 2px 10px
- font: caption (12px/600)

Status Badges:
- Dot indicator (8px circle) + text
- Colors: success/warning/destructive/info
```

### Form Inputs

```
Default Input:
- height: 40px (md), 48px (lg)
- bg: var(--muted), border: 1px solid var(--border)
- border-radius: 10px
- padding: 0 12px
- font: 14px Inter
- placeholder: var(--muted-foreground)

Focus: border-color var(--ring), ring 2px var(--ring)/20%
Error: border-color var(--destructive), ring var(--destructive)/20%
Disabled: opacity 0.5

Label: 13px/500 Inter, var(--foreground), margin-bottom 6px
Helper: 12px/400 Inter, var(--muted-foreground), margin-top 4px
Error msg: 12px/400 Inter, var(--destructive), margin-top 4px
```

### Sidebar Navigation

```
Layout:
- Width: 256px expanded, 72px collapsed
- bg: var(--card), border-right: 1px solid var(--border)
- padding: 16px 12px

Nav Item:
- height: 40px, border-radius: 10px
- padding: 0 12px, gap: 12px (icon + label)
- icon: 20px Lucide icons
- font: 14px/500 Inter

Active: bg var(--primary)/10%, text var(--primary), font-weight 600
Hover: bg var(--muted)
```

### Markdown Renderer

```
Code blocks:
- bg: var(--muted), border-radius: 12px
- padding: 16px
- font: JetBrains Mono 14px
- syntax highlighting: Shiki with github-dark/github-light themes
- copy button top-right

Inline code:
- bg: var(--muted), border-radius: 4px
- padding: 2px 6px
- font: JetBrains Mono 13px

Images: border-radius 12px, max-width 100%
Mermaid diagrams: centered, max-width 100%
Math (KaTeX): default sizing, centered for block math
```

---

## 5. Animation & Motion

### Timing Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `--transition-fast` | 150ms | ease-out | Hover states, toggles |
| `--transition-normal` | 200ms | ease-out | Card interactions, buttons |
| `--transition-slow` | 300ms | ease-out | Page transitions, modals |
| `--transition-spring` | 400ms | cubic-bezier(0.16,1,0.3,1) | Sheet/modal enter, card expand |

### Micro-interactions

| Element | Animation | Duration |
|---------|-----------|----------|
| Button hover | brightness + slight scale | 150ms ease-out |
| Card hover | shadow expand + translateY(-1px) | 200ms ease-out |
| Modal enter | scale(0.95) + opacity(0) -> normal | 300ms spring |
| Modal exit | opacity -> 0 | 200ms ease-in |
| Toast enter | translateY(16px) + opacity(0) -> normal | 300ms spring |
| Toast exit | opacity -> 0 | 150ms ease-in |
| Sidebar collapse | width transition | 200ms ease-out |
| Tab switch | opacity crossfade | 150ms |
| Dropdown open | scale(0.95) + opacity(0) -> normal | 150ms ease-out |
| Skeleton pulse | opacity 0.5 <-> 1.0 | 1.5s ease-in-out infinite |
| Score count-up | number animation | 800ms ease-out |
| Progress bar fill | width from 0 | 600ms ease-out |

### Rules

- Respect `prefers-reduced-motion`: disable all non-essential animations
- Exit animations shorter than enter (60-70% duration)
- Never animate width/height — use transform/opacity only
- Never block user input during animation
- Stagger list items by 30-50ms on entrance
- Timer countdown: use `tabular-nums` + smooth width (no layout shift)

---

## 6. Page-by-Page Design Direction

### 6.1 Login Page

```
Layout: Centered card on gradient background
- Full-screen gradient bg (var(--gradient-primary) at 5% opacity)
- Animated ambient blobs (subtle, slow 10s movement)
- Centered glass card (max-width 400px)
- Platform logo + tagline at top
- "Sign in with Google" button (Clerk component)
- Minimal: no registration, no form fields
```

### 6.2 Teacher Dashboard (Home)

```
Layout: Bento grid dashboard
- Top: Welcome banner with gradient accent stripe
  "Good morning, [Name]" + date + quick stats
- Bento Grid:
  - KPI cards: Total Questions, Total Assessments, Active Classrooms, Students
  - Recent Activity feed (latest comments, submissions)
  - Upcoming Assessments (calendar strip)
  - Quick Actions card (+ New Question, + New Assessment, + New Classroom)
- Each KPI: metric number (32px Outfit bold) + sparkline + trend badge
```

### 6.3 Question Bank

```
Layout: List/grid view with filter sidebar
- Top bar: Title + Search + Filters toggle + View toggle (list/grid) + "New Question"
- Filter panel (collapsible sidebar or sheet):
  - Tag multi-select with color dots
  - Complexity range slider (1-5)
  - Complexity type dropdown
  - Date range
- Question cards (list mode):
  - Truncated markdown preview (2 lines)
  - Tags (colored chips)
  - Complexity badge (pill with color)
  - Created date, linked assessments count
  - Actions: Edit, Duplicate, Delete
- Question cards (grid mode):
  - Taller card, more preview content
  - Same metadata
- Empty state: illustration + "Create your first question" CTA

Question Editor (modal or full page):
- Split view: Editor (left) + Live Preview (right)
- Markdown editor with toolbar (bold, code, image upload, mermaid)
- Options editor: list of 4 options with radio for correct answer
- Tag selector (multi-select with create)
- Complexity selector (1-5 visual scale)
- Complexity type dropdown
- Explanation field (markdown, collapsible)
```

### 6.4 Assessment Bank

```
Layout: Card list with creation wizard
- Top bar: Title + Search + Type filter (test/quiz/practice) + "New Assessment"
- Assessment cards:
  - Title, type badge, question count
  - Time limit, score config summary
  - Linked classrooms count
  - Created date
  - Actions: Edit, Duplicate, Preview, Assign

Assessment Creator (multi-step wizard):
Step 1 - Basic Info:
  - Title, description, type selector (toggle group)
  - Time limit (minutes input)

Step 2 - Questions:
  - Tab: Manual Select | Auto Generate
  - Manual: searchable question picker with tag/complexity filters
  - Auto Generate:
    - Total question count input
    - Category distribution: tag + percentage (visual bar)
    - Complexity distribution per category: stacked bar editor
    - Score per correct / Penalty per incorrect
    - "Generate" button -> preview with shortfall warnings

Step 3 - Settings:
  - Shuffle questions toggle
  - Shuffle options toggle
  - Show results: immediately / after due / never
  - Review + Create

Assessment Preview:
  - Student-view simulation of the assessment
  - Navigate between questions
  - See scoring rules
```

### 6.5 Classroom

```
Layout: Tab-based classroom view
- Header: Classroom name + description + member count + invite code
- Tabs: Feed | Members | Assessments | Settings

Feed Tab:
- Unified feed of announcements + assessment assignments
- "New Post" composer at top (expandable):
  - Type toggle: Announcement | Assessment
  - Markdown editor for announcements
  - Assessment picker + due date for assignments
- Post cards:
  - Author avatar + name + role badge + timestamp
  - Post type indicator (icon + color)
  - Content (markdown rendered)
  - Assessment link card (if applicable) with due date countdown
  - Comment count + "View Comments" expand
  - Comments section (threaded):
    - Comment input with @mention autocomplete
    - Nested replies (max 2 levels deep in UI)
    - Reply button, edit/delete for own comments

Members Tab:
- Member list grouped by role (Teachers, Students, Parents)
- Avatar + name + email + role badge
- Add member (email input + role selector)
- Remove member (with confirmation)

Assessments Tab:
- List of assigned assessments
- Status per student (not started / in progress / submitted)
- Average score, completion rate

Settings Tab (teacher only):
- Edit name, description
- Manage invite code
- Archive classroom
```

### 6.6 Assessment Taking (Student View)

```
Layout: Full-screen focused view (no sidebar)
- Top bar:
  - Assessment title
  - Timer (countdown, prominent, tabular-nums)
    - Normal: var(--foreground)
    - < 5 min: var(--warning), gentle pulse
    - < 1 min: var(--destructive), faster pulse
  - Progress indicator (X of N questions)
  - Submit button

- Main content:
  - Question number + complexity badge
  - Question content (markdown rendered)
  - Options as selectable cards:
    - Unselected: border only
    - Selected: primary bg at 10%, border var(--primary), check icon
    - Correct (after submit): green bg, checkmark
    - Incorrect (after submit): red bg, X mark + correct highlighted
  - Navigation: Previous / Next buttons + question grid (numbered pills)

- Question grid sidebar (collapsible):
  - Numbered circles
  - States: unanswered (outline), answered (filled primary), current (ring), flagged (star)
  - Flag for review toggle

- Anti-cheat banner:
  - Tab switch detected: subtle warning toast "Focus returned"
  - Count stored, visible to teacher in results

- Auto-submit modal:
  - "Time's up! Your assessment has been submitted."
  - Score summary (if show_results = immediately)
```

### 6.7 Parent Dashboard

```
Layout: Overview dashboard with student selector
- Top: Student selector (dropdown if multiple children)
- Bento Grid:
  - Overall Score KPI (gauge chart, avg across all assessments)
  - Trend Line (score over time, line chart)
  - Per-Tag Performance (radar chart or horizontal bar)
  - Recent Activity feed (assessments taken, scores, classroom joins)
  - Assessment History table:
    - Assessment name, classroom, date, score, time taken
    - Expandable: per-question breakdown
  - Classroom Overview cards:
    - Classroom name, teacher, recent announcements count
    - Student's assessment completion rate

Chart patterns:
- Gauge: overall performance vs class average
- Line: score trend over last 30 days
- Bar: per-tag/category performance
- Colors: student line in cyan, class average in muted gray
```

### 6.8 Notification Panel

```
Layout: Slide-out panel from right (or dropdown from bell icon)
- Glass card bg with blur
- Header: "Notifications" + Mark All Read
- Grouped by today / this week / earlier
- Notification item:
  - Icon (type-specific: comment, mention, assessment, announcement)
  - Actor avatar + short message
  - Timestamp (relative: "2m ago")
  - Unread: left border accent + bold text
  - Click: navigate to source
```

---

## 7. Icon System

**Library**: Lucide React (consistent stroke width, clean aesthetic)

| Category | Icons |
|----------|-------|
| Navigation | `home`, `book-open`, `clipboard-list`, `users`, `layout-dashboard`, `bell`, `settings` |
| Actions | `plus`, `pencil`, `trash-2`, `copy`, `share`, `download`, `upload` |
| Content | `file-text`, `image`, `code`, `hash`, `tag`, `clock`, `calendar` |
| Assessment | `check-circle`, `x-circle`, `timer`, `trophy`, `target`, `bar-chart` |
| Social | `message-circle`, `at-sign`, `reply`, `heart`, `flag` |
| Status | `circle` (empty), `check` (done), `alert-triangle` (warning), `info` (info) |

**Icon sizing**: 16px (inline), 20px (nav/buttons), 24px (headers), 32px (empty states)

---

## 8. Accessibility Checklist

- [ ] Color contrast 4.5:1 minimum for text (7:1 for critical UI)
- [ ] Focus rings visible (2px var(--ring), offset-2)
- [ ] Keyboard navigation: Tab order matches visual order
- [ ] No color-only information (add icons/text alongside)
- [ ] Touch targets: minimum 44x44px
- [ ] `prefers-reduced-motion` disables non-essential animation
- [ ] All images have meaningful alt text
- [ ] ARIA labels on icon-only buttons
- [ ] Form labels associated with inputs (never placeholder-only)
- [ ] Error messages near field + include recovery path
- [ ] Skip-to-content link for keyboard users
- [ ] Semantic heading hierarchy (h1 > h2 > h3, no skips)
- [ ] Toast notifications: auto-dismiss 3-5s, `aria-live="polite"`
- [ ] Destructive actions require confirmation dialog

---

## 9. Dark Mode Rules

- Never use pure `#000000` background (causes OLED smear)
- Desaturate and lighten primary colors (500 -> 400 shade)
- Borders use `rgba(255,255,255,0.08)` instead of solid colors
- Card elevation expressed via slightly lighter bg, not shadow
- Test all color combinations separately for dark mode contrast
- Glassmorphism: reduce blur intensity slightly, increase border opacity
- Code blocks: use dark syntax theme (e.g., github-dark)

---

## 10. Responsive Strategy

### Mobile-First Approach

| Breakpoint | Layout Changes |
|------------|---------------|
| < 640px | Single column, bottom nav (5 items max), full-width cards, sidebar hidden |
| 640-768px | 2 columns for bento grid, sidebar as overlay sheet |
| 768-1024px | Sidebar visible (collapsed), 2-3 column grid |
| 1024-1280px | Sidebar expanded, full bento grid |
| 1280px+ | Max content width 1200px, comfortable spacing |

### Mobile-Specific

- Assessment taking: full-screen, question grid becomes bottom sheet
- Sidebar: slide-out drawer with overlay
- Comments: full-width, reply indent reduced
- Tables: horizontal scroll or card-view transformation
- Timer: sticky at top during assessment
- Touch targets: all interactive elements 44px+ height

---

## 11. Loading & Empty States

### Skeleton Screens

```
Cards: rounded rectangle skeletons matching card dimensions
Text: 3 lines of varying width (100%, 80%, 60%)
Avatar: circle skeleton
Charts: rectangle skeleton with muted bg
Pulse animation: opacity 0.5 <-> 1.0, 1.5s ease-in-out
```

### Empty States

```
Pattern: Centered illustration + headline + description + CTA

Question Bank: "No questions yet" -> "Create your first question"
Assessment Bank: "No assessments yet" -> "Create your first assessment"
Classroom Feed: "It's quiet here" -> "Post an announcement"
Classroom Members: "No members yet" -> "Invite students"
Parent Dashboard: "No activity yet" -> "Student hasn't taken any assessments"
Notifications: "All caught up!" (checkmark illustration)
```

---

## 12. Chart & Data Visualization (Parent Dashboard)

### Library: Recharts

### Chart Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Student line | `#06B6D4` (Cyan) | Student's performance line |
| Class average | `#94A3B8` (Slate 400) | Comparison baseline |
| Grid lines | `#E2E8F0` (Slate 200) | Light, subtle |
| Tooltip bg | `var(--card)` | With shadow |
| Axis text | `var(--muted-foreground)` | 12px Inter |

### Chart Rules

- Always show legends near chart (not below scroll fold)
- Tooltips on hover (desktop) / tap (mobile) with exact values
- Use `tabular-nums` for all data labels
- Respect `prefers-reduced-motion` (disable entrance animations)
- Provide data table alternative for screen readers
- Max 5 categories in pie/donut charts
- Time series: clearly label granularity (day/week/month)
- Responsive: simplify on mobile (fewer ticks, horizontal bars)
