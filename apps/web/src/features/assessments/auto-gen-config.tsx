import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { Plus, X } from "lucide-react";
import { DistributionBar } from "./distribution-bar";
import { COMPLEXITY_LEVELS } from "@teaching/shared";
import type { Tag } from "@teaching/shared";

/** Per-complexity percentage config */
interface CompConfig {
  level: 1 | 2 | 3 | 4 | 5;
  percent: number;
}

/** Per-tag config with complexity breakdown */
export interface TagGenConfig {
  tagId: string;
  tagName: string;
  percent: number;
  complexities: CompConfig[];
}

export interface GenConfig {
  totalQuestions: number;
  scorePerCorrect: number;
  penaltyPerIncorrect: number;
  tags: TagGenConfig[];
}

interface AutoGenConfigProps {
  config: GenConfig;
  onChange: (config: GenConfig) => void;
}

const COMP_COLORS = ["#10B981", "#14B8A6", "#F59E0B", "#F97316", "#F43F5E"];

export function AutoGenConfig({ config, onChange }: AutoGenConfigProps) {
  const { getToken } = useAuth();
  const [showTagPicker, setShowTagPicker] = useState(false);

  const { data: tagsData } = useQuery<{ items: Tag[] }>({
    queryKey: ["tags", "all"],
    queryFn: async () => {
      const t = await getToken();
      return fetchApi("/api/tags", {}, t) as Promise<{ items: Tag[] }>;
    },
    staleTime: 60_000,
  });

  const allTags = tagsData?.items ?? [];
  const usedTagIds = new Set(config.tags.map((t) => t.tagId));

  function addTag(tag: Tag) {
    const defaultComplexities: CompConfig[] = COMPLEXITY_LEVELS.map((level) => ({
      level,
      percent: level === 3 ? 100 : 0, // default: all medium
    }));
    onChange({
      ...config,
      tags: [...config.tags, { tagId: tag.id, tagName: tag.name, percent: 0, complexities: defaultComplexities }],
    });
    setShowTagPicker(false);
  }

  function removeTag(tagId: string) {
    onChange({ ...config, tags: config.tags.filter((t) => t.tagId !== tagId) });
  }

  function updateTagPercent(tagId: string, percent: number) {
    onChange({
      ...config,
      tags: config.tags.map((t) => (t.tagId === tagId ? { ...t, percent } : t)),
    });
  }

  function updateCompPercent(tagId: string, level: number, percent: number) {
    onChange({
      ...config,
      tags: config.tags.map((t) =>
        t.tagId === tagId
          ? { ...t, complexities: t.complexities.map((c) => (c.level === level ? { ...c, percent } : c)) }
          : t
      ),
    });
  }

  const tagPercentTotal = config.tags.reduce((sum, t) => sum + t.percent, 0);

  return (
    <div className="space-y-4">
      {/* Total questions + scoring */}
      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>Total Questions</span>
          <input
            type="number"
            min={1}
            max={200}
            value={config.totalQuestions}
            onChange={(e) => onChange({ ...config, totalQuestions: Number(e.target.value) || 1 })}
            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>Score / Correct</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={config.scorePerCorrect}
            onChange={(e) => onChange({ ...config, scorePerCorrect: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>Penalty / Incorrect</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={config.penaltyPerIncorrect}
            onChange={(e) => onChange({ ...config, penaltyPerIncorrect: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
            style={{ borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }}
          />
        </label>
      </div>

      {/* Tag distribution overview bar */}
      {config.tags.length > 0 && (
        <DistributionBar
          segments={config.tags.map((t) => ({
            label: t.tagName,
            percent: t.percent,
            color: `var(--color-primary)`,
          }))}
        />
      )}

      {/* Tag percent total warning */}
      {config.tags.length > 0 && tagPercentTotal !== 100 && (
        <p className="text-xs" style={{ color: "var(--color-warning)" }}>
          Tag percentages sum to {tagPercentTotal}% (should be 100%)
        </p>
      )}

      {/* Per-tag configuration */}
      {config.tags.map((tagConfig) => {
        const compTotal = tagConfig.complexities.reduce((s, c) => s + c.percent, 0);
        return (
          <div
            key={tagConfig.tagId}
            className="rounded-xl border p-3 space-y-2"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                {tagConfig.tagName}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={tagConfig.percent}
                  onChange={(e) => updateTagPercent(tagConfig.tagId, Number(e.target.value) || 0)}
                  className="w-16 px-2 py-1 rounded-lg border text-xs text-center outline-none"
                  style={{ borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }}
                />
                <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>%</span>
                <button type="button" onClick={() => removeTag(tagConfig.tagId)} className="hover:opacity-70" style={{ color: "var(--color-muted-foreground)" }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Complexity breakdown */}
            <div className="grid grid-cols-5 gap-2">
              {tagConfig.complexities.map((comp) => (
                <label key={comp.level} className="space-y-0.5 text-center">
                  <span className="text-[10px] font-medium" style={{ color: COMP_COLORS[comp.level - 1] }}>
                    L{comp.level}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={comp.percent}
                    onChange={(e) => updateCompPercent(tagConfig.tagId, comp.level, Number(e.target.value) || 0)}
                    className="w-full px-1 py-1 rounded-lg border text-xs text-center outline-none"
                    style={{ borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }}
                  />
                </label>
              ))}
            </div>
            {compTotal !== 100 && (
              <p className="text-[10px]" style={{ color: "var(--color-warning)" }}>
                Complexity: {compTotal}% (should be 100%)
              </p>
            )}
          </div>
        );
      })}

      {/* Add tag button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowTagPicker((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)]"
          style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
        >
          <Plus size={14} />
          Add Tag
        </button>
        {showTagPicker && (
          <div
            className="absolute left-0 top-full mt-1 z-10 w-56 rounded-xl border shadow-lg py-1 max-h-48 overflow-y-auto"
            style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
          >
            {allTags.filter((t) => !usedTagIds.has(t.id)).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => addTag(tag)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-muted)] transition-colors"
                style={{ color: "var(--color-foreground)" }}
              >
                {tag.name}
              </button>
            ))}
            {allTags.filter((t) => !usedTagIds.has(t.id)).length === 0 && (
              <p className="px-3 py-2 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                No more tags available
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
