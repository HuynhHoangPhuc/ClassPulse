import { ChevronDown, ChevronUp, X } from "lucide-react";
import { COMPLEXITY_LEVELS, COMPLEXITY_LABELS, COMPLEXITY_TYPES } from "@teaching/shared";
import { TagSelector } from "./tag-selector";

export interface FilterState {
  tagIds: string[];
  complexityMin: number;
  complexityMax: number;
  complexityType: string;
  search: string;
}

interface QuestionFilterPanelProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  token: string | null;
  open: boolean;
  onToggle: () => void;
}

const DEFAULT_FILTERS: FilterState = {
  tagIds: [],
  complexityMin: 1,
  complexityMax: 5,
  complexityType: "",
  search: "",
};

function hasActiveFilters(f: FilterState) {
  return (
    f.tagIds.length > 0 ||
    f.complexityMin !== 1 ||
    f.complexityMax !== 5 ||
    f.complexityType !== ""
  );
}

/**
 * Collapsible filter panel for the question bank list page.
 * Controlled open/close state is managed by the parent.
 */
export function QuestionFilterPanel({
  filters,
  onChange,
  token,
  open,
  onToggle,
}: QuestionFilterPanelProps) {
  function patch(partial: Partial<FilterState>) {
    onChange({ ...filters, ...partial });
  }

  const active = hasActiveFilters(filters);

  return (
    <div
      className="rounded-[var(--radius-card)] border overflow-hidden"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      {/* Header toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ color: "var(--color-foreground)" }}
      >
        <span className="flex items-center gap-2">
          Filters
          {active && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--color-primary)" }}
            />
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Collapsible body */}
      {open && (
        <div
          className="px-4 pb-4 space-y-4 border-t"
          style={{ borderColor: "var(--color-border)" }}
        >
          {/* Tags */}
          <div className="space-y-1 pt-3">
            <label
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              Tags
            </label>
            <TagSelector
              selectedTagIds={filters.tagIds}
              onChange={(ids) => patch({ tagIds: ids })}
              token={token}
            />
          </div>

          {/* Complexity range */}
          <div className="space-y-1">
            <label
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              Complexity
            </label>
            <div className="flex items-center gap-2">
              <select
                value={filters.complexityMin}
                onChange={(e) => patch({ complexityMin: Number(e.target.value) })}
                className="flex-1 text-sm px-2 py-1.5 rounded-[var(--radius-badge)] border bg-transparent"
                style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                {COMPLEXITY_LEVELS.map((l) => (
                  <option key={l} value={l} style={{ background: "var(--color-card)" }}>
                    {COMPLEXITY_LABELS[l]}
                  </option>
                ))}
              </select>
              <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>to</span>
              <select
                value={filters.complexityMax}
                onChange={(e) => patch({ complexityMax: Number(e.target.value) })}
                className="flex-1 text-sm px-2 py-1.5 rounded-[var(--radius-badge)] border bg-transparent"
                style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                {COMPLEXITY_LEVELS.map((l) => (
                  <option key={l} value={l} style={{ background: "var(--color-card)" }}>
                    {COMPLEXITY_LABELS[l]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Complexity type */}
          <div className="space-y-1">
            <label
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              Type
            </label>
            <select
              value={filters.complexityType}
              onChange={(e) => patch({ complexityType: e.target.value })}
              className="w-full text-sm px-2 py-1.5 rounded-[var(--radius-badge)] border bg-transparent capitalize"
              style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
            >
              <option value="" style={{ background: "var(--color-card)" }}>All types</option>
              {COMPLEXITY_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize" style={{ background: "var(--color-card)" }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Clear button */}
          {active && (
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_FILTERS, search: filters.search })}
              className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
              style={{ color: "var(--color-destructive)" }}
            >
              <X size={12} />
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
