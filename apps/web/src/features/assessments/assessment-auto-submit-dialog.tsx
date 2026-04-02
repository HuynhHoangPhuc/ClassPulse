import { Clock } from "lucide-react";

interface AutoSubmitDialogProps {
  isOpen: boolean;
  score?: number | null;
  totalPossible?: number | null;
  showScore: boolean;
  onViewResults: () => void;
}

/** Time's up modal with optional score summary */
export function AssessmentAutoSubmitDialog({
  isOpen,
  score,
  totalPossible,
  showScore,
  onViewResults,
}: AutoSubmitDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="rounded-[var(--radius-card)] border p-8 max-w-sm w-full mx-4 space-y-4 text-center"
        style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
      >
        <div
          className="mx-auto w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: "color-mix(in srgb, var(--color-destructive) 10%, transparent)" }}
        >
          <Clock size={24} style={{ color: "var(--color-destructive)" }} />
        </div>

        <h2 className="text-lg font-semibold" style={{ color: "var(--color-foreground)" }}>
          Time's Up!
        </h2>
        <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          Your assessment has been automatically submitted.
        </p>

        {showScore && score !== null && score !== undefined && totalPossible !== null && totalPossible !== undefined && (
          <div
            className="rounded-xl p-4 space-y-1"
            style={{ background: "var(--color-muted)" }}
          >
            <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
              {score} / {totalPossible}
            </p>
            <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
              {totalPossible > 0 ? Math.round((score / totalPossible) * 100) : 0}% correct
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onViewResults}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        >
          View Results
        </button>
      </div>
    </div>
  );
}
