import { useState } from "react";
import { Pencil, Trash2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COMPLEXITY_LABELS, COMPLEXITY_COLORS } from "@teaching/shared";
import type { Question, Tag, ComplexityLevel } from "@teaching/shared";

interface QuestionCardProps {
  question: Question & { tags: Tag[] };
  view: "list" | "grid";
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Displays a single question in list or grid layout.
 * Delete requires a confirmation click to prevent accidental removal.
 */
export function QuestionCard({ question, view, onEdit, onDelete }: QuestionCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const complexity = question.complexity as ComplexityLevel;
  const complexityColor = COMPLEXITY_COLORS[complexity];
  const complexityLabel = COMPLEXITY_LABELS[complexity];
  const lineClamp = view === "grid" ? "line-clamp-4" : "line-clamp-2";

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Auto-cancel confirmation after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  return (
    <Card
      variant="standard"
      className={cn(
        "flex gap-3 transition-shadow hover:shadow-md",
        view === "list" ? "flex-row items-start" : "flex-col"
      )}
    >
      {/* Content preview */}
      <div className="flex-1 min-w-0 space-y-2">
        <p
          className={cn("text-sm", lineClamp)}
          style={{ color: "var(--color-foreground)" }}
          title={question.content}
        >
          {question.content}
        </p>

        {/* Tags */}
        {question.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {question.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border"
                style={{
                  background: tag.color ? `${tag.color}22` : "var(--color-muted)",
                  borderColor: tag.color ?? "var(--color-border)",
                  color: tag.color ?? "var(--color-muted-foreground)",
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Complexity badge */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
            style={{
              background: `${complexityColor}22`,
              borderColor: complexityColor,
              color: complexityColor,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: complexityColor }}
            />
            {complexityLabel}
          </span>

          <span
            className="text-xs capitalize"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            {question.complexityType}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className={cn("flex gap-1 shrink-0", view === "list" ? "flex-col" : "flex-row justify-end")}>
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded transition-opacity hover:opacity-70"
          style={{ color: "var(--color-muted-foreground)" }}
          title="Edit question"
        >
          <Pencil size={14} />
        </button>

        <button
          type="button"
          onClick={handleDeleteClick}
          className="p-1.5 rounded transition-all hover:opacity-70"
          style={{ color: confirmDelete ? "var(--color-destructive)" : "var(--color-muted-foreground)" }}
          title={confirmDelete ? "Click again to confirm delete" : "Delete question"}
        >
          {confirmDelete ? <AlertCircle size={14} /> : <Trash2 size={14} />}
        </button>
      </div>
    </Card>
  );
}
