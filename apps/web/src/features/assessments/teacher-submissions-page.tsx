import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, Eye, Clock, AlertTriangle } from "lucide-react";

interface Submission {
  id: string;
  studentId: string;
  startedAt: number;
  submittedAt: number | null;
  isAutoSubmitted: number;
  score: number | null;
  totalPossible: number | null;
  status: string;
  tabSwitchCount: number;
  studentName: string;
  studentEmail: string;
  studentAvatar: string | null;
}

interface SubmissionsResponse {
  items: Submission[];
  nextCursor: string | null;
}

interface TeacherSubmissionsPageProps {
  classroomId: string;
  assessmentId: string;
}

export function TeacherSubmissionsPage({ classroomId, assessmentId }: TeacherSubmissionsPageProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const { data, isLoading } = useQuery<SubmissionsResponse>({
    queryKey: ["submissions", classroomId, assessmentId],
    queryFn: async () => {
      const t = await getToken();
      return fetchApi(
        `/api/classrooms/${classroomId}/assessments/${assessmentId}/submissions`,
        {},
        t,
      ) as Promise<SubmissionsResponse>;
    },
  });

  function formatDuration(startedAt: number, submittedAt: number | null): string {
    if (!submittedAt) return "—";
    const seconds = Math.floor((submittedAt - startedAt) / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submissions"
        description="View all student submissions for this assessment"
        actions={
          <button
            type="button"
            onClick={() => navigate({ to: "/classrooms/$classroomId", params: { classroomId } })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)]"
            style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        }
      />

      {isLoading && (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl" style={{ background: "var(--color-muted)" }} />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.items.length === 0) && (
        <EmptyState
          icon={<Clock size={32} style={{ color: "var(--color-muted-foreground)" }} />}
          headline="No submissions yet"
          description="Students haven't submitted any attempts for this assessment."
        />
      )}

      {data && data.items.length > 0 && (
        <div
          className="rounded-[var(--radius-card)] border overflow-hidden"
          style={{ borderColor: "var(--color-border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--color-muted)" }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--color-muted-foreground)" }}>Student</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--color-muted-foreground)" }}>Score</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--color-muted-foreground)" }}>Time</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--color-muted-foreground)" }}>Status</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--color-muted-foreground)" }}>Tab Switches</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "var(--color-muted-foreground)" }}></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((sub) => (
                <tr
                  key={sub.id}
                  className="border-t hover:bg-[var(--color-muted)]/50 transition-colors"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {sub.studentAvatar ? (
                        <img src={sub.studentAvatar} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: "var(--color-primary)", color: "#fff" }}
                        >
                          {sub.studentName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium" style={{ color: "var(--color-foreground)" }}>{sub.studentName}</p>
                        <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>{sub.studentEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono" style={{ color: "var(--color-foreground)" }}>
                    {sub.score !== null ? `${sub.score}/${sub.totalPossible}` : "—"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-muted-foreground)" }}>
                    {formatDuration(sub.startedAt, sub.submittedAt)}
                  </td>
                  <td className="px-4 py-3">
                    {sub.status === "submitted" ? (
                      <Badge variant={sub.isAutoSubmitted ? "warning" : "success"}>
                        {sub.isAutoSubmitted ? "Auto-submitted" : "Submitted"}
                      </Badge>
                    ) : (
                      <Badge>{sub.status}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {sub.tabSwitchCount > 0 ? (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-warning)" }}>
                        <AlertTriangle size={12} /> {sub.tabSwitchCount}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => navigate({
                        to: "/classrooms/$classroomId/assessments/$assessmentId/attempts/$attemptId/detail",
                        params: { classroomId, assessmentId, attemptId: sub.id },
                      })}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors hover:bg-[var(--color-muted)]"
                      style={{ color: "var(--color-primary)" }}
                    >
                      <Eye size={12} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
