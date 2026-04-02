import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

interface ClassroomCardProps {
  classroom: {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
    userRole?: string;
  };
  onClick: () => void;
}

const roleBadgeVariant: Record<string, "default" | "secondary" | "warning"> = {
  teacher: "default",
  student: "secondary",
  parent: "warning",
};

export function ClassroomCard({ classroom, onClick }: ClassroomCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-[var(--radius-card)] border p-5 transition-shadow hover:shadow-md space-y-2"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-sm font-semibold truncate"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
        >
          {classroom.name}
        </h3>
        {classroom.userRole && (
          <Badge variant={roleBadgeVariant[classroom.userRole] ?? "default"}>
            {classroom.userRole}
          </Badge>
        )}
      </div>
      {classroom.description && (
        <p className="text-xs line-clamp-2" style={{ color: "var(--color-muted-foreground)" }}>
          {classroom.description}
        </p>
      )}
      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        <Users size={12} />
        {classroom.memberCount} member{classroom.memberCount !== 1 ? "s" : ""}
      </span>
    </button>
  );
}
