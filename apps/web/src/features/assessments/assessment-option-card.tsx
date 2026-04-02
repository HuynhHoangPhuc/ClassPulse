import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssessmentOptionCardProps {
  id: string;
  text: string;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  /** Post-submit states */
  correctOptionId?: string;
  showResult?: boolean;
}

/** Selectable option card with radio behavior */
export function AssessmentOptionCard({
  id,
  text,
  index,
  isSelected,
  onSelect,
  correctOptionId,
  showResult,
}: AssessmentOptionCardProps) {
  const isCorrect = showResult && id === correctOptionId;
  const isIncorrect = showResult && isSelected && id !== correctOptionId;

  const borderColor = isCorrect
    ? "var(--color-success)"
    : isIncorrect
      ? "var(--color-destructive)"
      : isSelected
        ? "var(--color-primary)"
        : "var(--color-border)";

  const bgColor = isCorrect
    ? "var(--color-success)"
    : isIncorrect
      ? "var(--color-destructive)"
      : isSelected
        ? "var(--color-primary)"
        : "transparent";

  return (
    <button
      type="button"
      onClick={() => !showResult && onSelect(id)}
      disabled={!!showResult}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-sm text-left transition-all",
        !showResult && "hover:bg-[var(--color-muted)] cursor-pointer",
        showResult && "cursor-default",
      )}
      style={{
        borderColor,
        background: (isCorrect || isIncorrect) ? `color-mix(in srgb, ${bgColor} 10%, transparent)` : isSelected ? "color-mix(in srgb, var(--color-primary) 10%, transparent)" : "var(--color-card)",
      }}
    >
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          background: isSelected || isCorrect || isIncorrect ? bgColor : "var(--color-muted)",
          color: isSelected || isCorrect || isIncorrect ? "#fff" : "var(--color-muted-foreground)",
          border: `1px solid ${borderColor}`,
        }}
      >
        {isSelected && !showResult ? <Check size={14} /> : String.fromCharCode(65 + index)}
      </span>
      <span style={{ color: "var(--color-foreground)" }}>{text}</span>
      {isCorrect && (
        <Check size={16} className="ml-auto shrink-0" style={{ color: "var(--color-success)" }} />
      )}
    </button>
  );
}
