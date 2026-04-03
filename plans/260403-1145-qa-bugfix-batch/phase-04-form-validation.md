# Phase 4 — Form Validation Feedback

## Priority: MEDIUM
## Status: Complete
## Effort: 1.5h

## Context

- Assessment wizard: "Next" button is disabled when validation fails, but NO visual hint explains why
- Classroom creation: "Create" button silently ignores empty required Name field (no error shown)
- Question editor: Already has good validation pattern (`saveError` state + red banner)

## Root Cause

### Assessment wizard (`assessment-wizard-page.tsx`)
- `canProceed()` function correctly validates but only disables button
- No error message shown — user sees a greyed-out button with no explanation
- Step 1: title required; Step 2: questions required

### Classroom creation (`classroom-list-page.tsx`)
- Button disabled when `!newName.trim()` — same pattern, no error text

## Requirements

### Functional
- Show inline validation message when user attempts to proceed with invalid form
- Match existing error pattern from question editor (red banner with message)
- Assessment wizard Step 1: "Title is required" when Next clicked with empty title
- Assessment wizard Step 2: "Select at least one question" (manual) or "Add at least one tag" (auto-gen)
- Classroom modal: "Classroom name is required" when Create clicked with empty name

### Non-functional
- Consistent error styling across all forms

## Related Code Files

### Files to modify:
- `apps/web/src/features/assessments/assessment-wizard-page.tsx` — Add validation messages
- `apps/web/src/features/classrooms/classroom-list-page.tsx` — Add validation to Create modal

### Files to read for context:
- `apps/web/src/features/questions/question-editor-page.tsx` — Reference pattern for error display

## Implementation Steps

### Step 1: Assessment wizard — Add validation messages

**File:** `apps/web/src/features/assessments/assessment-wizard-page.tsx`

1. Add `validationError` state: `useState<string | null>(null)`
2. Modify `handleNext()`:
   ```typescript
   function handleNext() {
     if (!canProceed()) {
       if (step === 0) setValidationError("Title is required.");
       if (step === 1) {
         setValidationError(
           state.questionMode === "manual"
             ? "Select at least one question."
             : "Add at least one tag for auto-generation."
         );
       }
       return;
     }
     setValidationError(null);
     // ... proceed
   }
   ```
3. Remove `disabled={!canProceed()}` from Next button — let user click and see the error
4. Display validation error above the button bar (red banner matching question editor style)
5. Clear error when step changes or input changes

### Step 2: Classroom creation — Add validation

**File:** `apps/web/src/features/classrooms/classroom-list-page.tsx`

1. Add `nameError` state
2. On Create click with empty name: `setNameError("Classroom name is required.")`
3. Show error text below Name input in red
4. Clear error on input change

## Todo List

- [x] Add validation messages to assessment wizard (Step 1 & 2)
- [x] Make Next button always clickable, show error on invalid click
- [x] Add validation message to classroom creation modal
- [x] Verify consistent error styling across forms

## Success Criteria

- Clicking Next on assessment wizard with empty title shows "Title is required"
- Clicking Next on Step 2 with no questions shows relevant error
- Clicking Create Classroom with empty name shows error
- Errors clear when user fixes the issue
