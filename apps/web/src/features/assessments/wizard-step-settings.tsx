import { SHOW_RESULTS_OPTIONS } from "@teaching/shared";
import type { ShowResults } from "@teaching/shared";

export interface SettingsData {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResults: ShowResults;
  scorePerCorrect: number;
  penaltyPerIncorrect: number;
}

interface WizardStepSettingsProps {
  data: SettingsData;
  onChange: (data: SettingsData) => void;
  /** Summary stats for the review section */
  questionCount: number;
  assessmentTitle: string;
  assessmentType: string;
}

const SHOW_RESULTS_LABELS: Record<string, string> = {
  immediately: "Immediately after submission",
  after_due: "After due date",
  never: "Never show results",
};

export function WizardStepSettings({ data, onChange, questionCount, assessmentTitle, assessmentType }: WizardStepSettingsProps) {
  return (
    <div className="space-y-5">
      {/* Review summary */}
      <div
        className="rounded-xl border p-4 space-y-2"
        style={{ borderColor: "var(--color-border)", background: "var(--color-muted)" }}
      >
        <h4 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>Review</h4>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <span style={{ color: "var(--color-muted-foreground)" }}>Title:</span>
            <p className="font-medium" style={{ color: "var(--color-foreground)" }}>{assessmentTitle || "—"}</p>
          </div>
          <div>
            <span style={{ color: "var(--color-muted-foreground)" }}>Type:</span>
            <p className="font-medium capitalize" style={{ color: "var(--color-foreground)" }}>{assessmentType}</p>
          </div>
          <div>
            <span style={{ color: "var(--color-muted-foreground)" }}>Questions:</span>
            <p className="font-medium" style={{ color: "var(--color-foreground)" }}>{questionCount}</p>
          </div>
        </div>
      </div>

      {/* Shuffle toggles */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>Shuffle</h4>
        {[
          { key: "shuffleQuestions" as const, label: "Shuffle question order" },
          { key: "shuffleOptions" as const, label: "Shuffle answer options" },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={data[key]}
              onClick={() => onChange({ ...data, [key]: !data[key] })}
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{ background: data[key] ? "var(--color-primary)" : "var(--color-muted)" }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                style={{ left: data[key] ? "calc(100% - 18px)" : "2px" }}
              />
            </button>
            <span className="text-sm" style={{ color: "var(--color-foreground)" }}>{label}</span>
          </label>
        ))}
      </div>

      {/* Show results mode */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>Show Results</h4>
        <div className="space-y-1.5">
          {SHOW_RESULTS_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-3 cursor-pointer">
              <div
                className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: data.showResults === option ? "var(--color-primary)" : "var(--color-border)" }}
              >
                {data.showResults === option && (
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--color-primary)" }} />
                )}
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...data, showResults: option })}
                className="text-sm text-left"
                style={{ color: "var(--color-foreground)" }}
              >
                {SHOW_RESULTS_LABELS[option]}
              </button>
            </label>
          ))}
        </div>
      </div>

      {/* Scoring */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>Scoring</h4>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Points per correct</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={data.scorePerCorrect}
              onChange={(e) => onChange({ ...data, scorePerCorrect: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
              style={{ borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Penalty per incorrect</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={data.penaltyPerIncorrect}
              onChange={(e) => onChange({ ...data, penaltyPerIncorrect: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
              style={{ borderColor: "var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
