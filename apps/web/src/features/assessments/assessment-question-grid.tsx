import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionGridProps {
  total: number;
  currentIndex: number;
  answeredIds: Set<string>;
  flaggedIds: Set<string>;
  questionIds: string[];
  onNavigate: (index: number) => void;
}

/** Numbered navigation grid: answered/unanswered/current/flagged states */
export function AssessmentQuestionGrid({
  total,
  currentIndex,
  answeredIds,
  flaggedIds,
  questionIds,
  onNavigate,
}: QuestionGridProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {Array.from({ length: total }, (_, i) => {
        const qid = questionIds[i];
        const isCurrent = i === currentIndex;
        const isAnswered = answeredIds.has(qid);
        const isFlagged = flaggedIds.has(qid);

        return (
          <button
            key={i}
            type="button"
            onClick={() => onNavigate(i)}
            className={cn(
              "relative w-8 h-8 rounded-lg text-xs font-medium transition-colors",
              isCurrent && "ring-2 ring-[var(--color-primary)]",
              !isCurrent && "hover:bg-[var(--color-muted)]",
            )}
            style={{
              background: isAnswered ? "var(--color-primary)" : "transparent",
              color: isAnswered ? "#fff" : "var(--color-muted-foreground)",
            }}
          >
            {i + 1}
            {isFlagged && (
              <Flag
                size={8}
                className="absolute -top-1 -right-1"
                style={{ color: "var(--color-warning)" }}
                fill="var(--color-warning)"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
