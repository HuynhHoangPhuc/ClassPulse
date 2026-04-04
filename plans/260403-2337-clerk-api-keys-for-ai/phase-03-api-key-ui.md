## Phase 3: API Key Management UI

**Priority:** Medium
**Status:** Complete
**Effort:** 2h
**Depends on:** Phase 2

### Context Links
- [Settings page](../../apps/web/src/features/settings/settings-page.tsx)
- [fetchApi wrapper](../../apps/web/src/lib/fetch-api.ts)
- [Design guidelines](../../docs/design-guidelines.md)

### Overview

Add "API Keys" card to the Settings page. Teachers can create keys (shown once), view existing keys, copy secrets, and revoke keys. Uses existing Card/Button components and fetchApi wrapper.

### Key Insights

- Secret is shown only once on creation — must display prominently with copy button
- List view shows name, scopes, status (active/revoked/expired), created date
- Only teachers see API Keys card (role guard)
- Follow existing Settings page card pattern (icon + title + content)

### Requirements

**Functional:**
- "Create API Key" form: name input + optional expiration dropdown
- Display secret after creation with copy-to-clipboard + warning ("won't be shown again")
- Table/list of existing keys: name, status, created date, revoke button
- Confirm dialog before revoke
- Only visible to teacher role

**Non-functional:**
- Match existing Settings page design (Card, SettingsRow pattern)
- Use TanStack Query for data fetching (match existing patterns)
- Responsive layout

### Related Code Files

**Create:**
- `apps/web/src/features/settings/api-key-management-card.tsx` — main component
- `apps/web/src/features/settings/api-key-creation-dialog.tsx` — create + show secret dialog

**Modify:**
- `apps/web/src/features/settings/settings-page.tsx` — add API Keys card (teacher only)

### Implementation Steps

1. **Create `api-key-management-card.tsx`**:
   - Use TanStack Query: `useQuery` for listing keys, `useMutation` for create/revoke
   - API calls via `fetchApi`:
     - `GET /api/users/api-keys` → list
     - `POST /api/users/api-keys` → create
     - `DELETE /api/users/api-keys/:id` → revoke
   - Table rows: name, status badge (active/revoked), created date, revoke button
   - Empty state: "No API keys yet. Create one to allow AI tools to access your account."

2. **Create `api-key-creation-dialog.tsx`**:
   - Form: key name (required), expiration (optional: 30d/90d/180d/365d/never)
   - On submit: POST to API, display returned secret
   - Secret display: monospace font, copy button, yellow warning banner
   - "I've copied the key" confirmation button to close
   - Scopes hardcoded to `["ai:questions:write"]` for now (can expand later)

3. **Modify `settings-page.tsx`**:
   - Import `ApiKeyManagementCard`
   - Conditionally render for teacher role:
     ```tsx
     {appUser?.role === "teacher" && <ApiKeyManagementCard />}
     ```
   - Place after Notifications card

4. **Compile check**: `pnpm --filter web build`

### Todo List

- [x] Create `api-key-management-card.tsx` with list + revoke
- [x] Create `api-key-creation-dialog.tsx` with form + secret display
- [x] Add API Keys card to settings-page.tsx (teacher only)
- [x] Add copy-to-clipboard for secret
- [x] Compile check

### Success Criteria

- Teachers see "API Keys" card in Settings
- Students/parents do not see it
- Create flow shows secret exactly once with copy button
- Key list shows all keys with status
- Revoke works with confirmation
- Matches existing design language
