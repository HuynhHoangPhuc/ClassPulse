import { ASSESSMENT_TYPES } from "@teaching/shared";
import type { AssessmentType } from "@teaching/shared";

export interface BasicInfo {
  title: string;
  description: string;
  type: AssessmentType;
  timeLimitMinutes: number | null;
}

interface WizardStepBasicInfoProps {
  data: BasicInfo;
  onChange: (data: BasicInfo) => void;
}

export function WizardStepBasicInfo({ data, onChange }: WizardStepBasicInfoProps) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <label className="block space-y-1">
        <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Title *</span>
        <input
          value={data.title}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
          placeholder="e.g. JavaScript Fundamentals Quiz"
          className="w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }}
        />
      </label>

      {/* Description */}
      <label className="block space-y-1">
        <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Description</span>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="Optional description…"
          rows={2}
          className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none transition-colors focus:border-[var(--color-primary)]"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }}
        />
      </label>

      {/* Type toggle */}
      <div className="space-y-1">
        <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Type *</span>
        <div className="flex gap-2">
          {ASSESSMENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ ...data, type: t })}
              className="px-4 py-2 rounded-xl border text-sm font-medium capitalize transition-colors"
              style={{
                borderColor: data.type === t ? "var(--color-primary)" : "var(--color-border)",
                background: data.type === t ? "var(--color-primary)" : "var(--color-card)",
                color: data.type === t ? "#fff" : "var(--color-foreground)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Time limit */}
      <label className="block space-y-1">
        <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Time Limit (minutes)</span>
        <input
          type="number"
          min={1}
          value={data.timeLimitMinutes ?? ""}
          onChange={(e) => onChange({ ...data, timeLimitMinutes: e.target.value ? Number(e.target.value) : null })}
          placeholder="No limit"
          className="w-40 px-3 py-2 rounded-xl border text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }}
        />
        <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Leave empty for no time limit</p>
      </label>
    </div>
  );
}
