import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface FeedPost {
  id: string;
  type: string;
  title: string;
  dueDate: number | null;
  assessment: { title: string; timeLimitMinutes: number | null } | null;
}

interface ClassroomAssessmentsTabProps {
  classroomId: string;
}

export function ClassroomAssessmentsTab({ classroomId }: ClassroomAssessmentsTabProps) {
  const { getToken } = useAuth();

  // Fetch feed and filter for assessment assignments
  const { data, isLoading } = useQuery<{ items: FeedPost[] }>({
    queryKey: ["classrooms", classroomId, "feed", "assessments"],
    queryFn: async () => {
      const t = await getToken();
      return fetchApi(`/api/classrooms/${classroomId}/feed?limit=50`, {}, t) as Promise<{ items: FeedPost[] }>;
    },
    staleTime: 30_000,
  });

  const assignments = (data?.items ?? []).filter((p) => p.type === "assessment_assignment" && p.assessment);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--color-muted)" }} />
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList size={32} />}
        headline="No assessments assigned"
        description="Assessments assigned to this classroom will appear here."
      />
    );
  }

  return (
    <div className="space-y-1">
      {/* Table header */}
      <div className="grid grid-cols-3 gap-4 px-3 py-2 text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>
        <span>Assessment</span>
        <span>Due Date</span>
        <span>Time Limit</span>
      </div>
      {assignments.map((a) => (
        <div
          key={a.id}
          className="grid grid-cols-3 gap-4 px-3 py-3 rounded-xl border text-sm"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          <span className="font-medium truncate" style={{ color: "var(--color-foreground)" }}>
            {a.assessment!.title}
          </span>
          <span style={{ color: a.dueDate ? "var(--color-warning)" : "var(--color-muted-foreground)" }}>
            {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "No due date"}
          </span>
          <span style={{ color: "var(--color-muted-foreground)" }}>
            {a.assessment!.timeLimitMinutes ? `${a.assessment!.timeLimitMinutes} min` : "Untimed"}
          </span>
        </div>
      ))}
    </div>
  );
}
