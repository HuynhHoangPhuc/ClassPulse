import { Badge } from "@/components/ui/badge";
import { Clock, FileText, MoreVertical, Copy, Eye, Pencil, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface AssessmentCardProps {
  assessment: {
    id: string;
    title: string;
    type: string;
    timeLimitMinutes: number | null;
    questionCount: number;
    createdAt: number;
  };
  onEdit: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
  onDelete: () => void;
}

const typeBadgeVariant: Record<string, "default" | "secondary" | "warning"> = {
  test: "default",
  quiz: "secondary",
  practice: "warning",
};

export function AssessmentCard({ assessment, onEdit, onDuplicate, onPreview, onDelete }: AssessmentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      className="rounded-[var(--radius-card)] border p-5 transition-shadow hover:shadow-md relative"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3
            className="text-sm font-semibold truncate"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
          >
            {assessment.title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant={typeBadgeVariant[assessment.type] ?? "default"}>
              {assessment.type}
            </Badge>
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
              <FileText size={12} />
              {assessment.questionCount} questions
            </span>
            {assessment.timeLimitMinutes && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                <Clock size={12} />
                {assessment.timeLimitMinutes}min
              </span>
            )}
          </div>
        </div>

        {/* Action menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-10 w-40 rounded-xl border shadow-lg py-1"
              style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
            >
              {[
                { label: "Edit", icon: <Pencil size={14} />, action: onEdit },
                { label: "Preview", icon: <Eye size={14} />, action: onPreview },
                { label: "Duplicate", icon: <Copy size={14} />, action: onDuplicate },
                { label: "Delete", icon: <Trash2 size={14} />, action: onDelete, destructive: true },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => { setMenuOpen(false); item.action(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-muted)] transition-colors"
                  style={{
                    color: (item as { destructive?: boolean }).destructive
                      ? "var(--color-destructive)"
                      : "var(--color-foreground)",
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
