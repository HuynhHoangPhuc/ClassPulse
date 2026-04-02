import { Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AssessmentOptionCard } from "./assessment-option-card";

interface QuestionOption {
  id: string;
  text: string;
}

interface AssessmentQuestionViewProps {
  questionIndex: number;
  totalQuestions: number;
  content: string;
  complexity: number;
  options: QuestionOption[];
  selectedOptionId: string | null;
  isFlagged: boolean;
  onSelectOption: (optionId: string) => void;
  onToggleFlag: () => void;
  /** Post-submit result display */
  correctOptionId?: string;
  showResult?: boolean;
}

/** Single question display with options and flag toggle */
export function AssessmentQuestionView({
  questionIndex,
  totalQuestions,
  content,
  complexity,
  options,
  selectedOptionId,
  isFlagged,
  onSelectOption,
  onToggleFlag,
  correctOptionId,
  showResult,
}: AssessmentQuestionViewProps) {
  return (
    <div
      className="rounded-[var(--radius-card)] border p-6 space-y-4"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--color-muted-foreground)" }}>
          Question {questionIndex + 1} of {totalQuestions}
        </span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">L{complexity}</Badge>
          {!showResult && (
            <button
              type="button"
              onClick={onToggleFlag}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors hover:bg-[var(--color-muted)]"
              style={{ color: isFlagged ? "var(--color-warning)" : "var(--color-muted-foreground)" }}
            >
              <Flag size={12} fill={isFlagged ? "var(--color-warning)" : "none"} />
              {isFlagged ? "Flagged" : "Flag"}
            </button>
          )}
        </div>
      </div>

      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-foreground)" }}>
        {content}
      </p>

      <div className="space-y-2">
        {options.map((opt, i) => (
          <AssessmentOptionCard
            key={opt.id}
            id={opt.id}
            text={opt.text}
            index={i}
            isSelected={selectedOptionId === opt.id}
            onSelect={onSelectOption}
            correctOptionId={correctOptionId}
            showResult={showResult}
          />
        ))}
      </div>
    </div>
  );
}
