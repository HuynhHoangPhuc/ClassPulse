import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft, Copy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClassroomFeedTab } from "./classroom-feed-tab";
import { ClassroomMembersTab } from "./classroom-members-tab";
import { ClassroomAssessmentsTab } from "./classroom-assessments-tab";
import { ClassroomSettingsTab } from "./classroom-settings-tab";
import { useNotifications } from "@/features/notifications/notification-provider";

type Tab = "feed" | "members" | "assessments" | "settings";

interface ClassroomDetail {
  id: string;
  teacherId: string;
  name: string;
  description: string | null;
  inviteCode: string;
  memberCount: number;
  isTeacher: boolean;
}

interface ClassroomDetailPageProps {
  classroomId: string;
}

export function ClassroomDetailPage({ classroomId }: ClassroomDetailPageProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("feed");
  const [copied, setCopied] = useState(false);
  const { setActiveClassroom } = useNotifications();

  // Connect WebSocket to this classroom's NotificationHub DO
  useEffect(() => {
    setActiveClassroom(classroomId);
    return () => setActiveClassroom(null);
  }, [classroomId, setActiveClassroom]);

  const { data: classroom, isLoading } = useQuery<ClassroomDetail>({
    queryKey: ["classrooms", classroomId],
    queryFn: async () => {
      const t = await getToken();
      return fetchApi(`/api/classrooms/${classroomId}`, {}, t) as Promise<ClassroomDetail>;
    },
  });

  if (isLoading || !classroom) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: "var(--color-muted)" }} />
        <div className="h-4 w-32 rounded animate-pulse" style={{ background: "var(--color-muted)" }} />
      </div>
    );
  }

  const isTeacher = classroom.isTeacher;

  const tabs: Array<{ key: Tab; label: string; teacherOnly?: boolean }> = [
    { key: "feed", label: "Feed" },
    { key: "members", label: "Members" },
    { key: "assessments", label: "Assessments" },
    { key: "settings", label: "Settings", teacherOnly: true },
  ];

  function handleCopy() {
    navigator.clipboard.writeText(classroom!.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={classroom.name}
        description={classroom.description ?? undefined}
        actions={
          <button
            type="button"
            onClick={() => navigate({ to: "/classrooms" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm hover:bg-[var(--color-muted)]"
            style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        }
      />

      {/* Meta bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          <Users size={14} /> {classroom.memberCount} member{classroom.memberCount !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors hover:bg-[var(--color-muted)]"
          style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
          title="Copy invite code"
        >
          <Copy size={10} />
          {classroom.inviteCode}
        </button>
        {copied && <span className="text-xs" style={{ color: "var(--color-success)" }}>Copied!</span>}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--color-border)" }}>
        {tabs
          .filter((t) => !t.teacherOnly || isTeacher)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn("px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors")}
              style={{
                borderColor: tab === t.key ? "var(--color-primary)" : "transparent",
                color: tab === t.key ? "var(--color-primary)" : "var(--color-muted-foreground)",
              }}
            >
              {t.label}
            </button>
          ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "feed" && <ClassroomFeedTab classroomId={classroomId} isTeacher={isTeacher} />}
        {tab === "members" && <ClassroomMembersTab classroomId={classroomId} isTeacher={isTeacher} />}
        {tab === "assessments" && <ClassroomAssessmentsTab classroomId={classroomId} />}
        {tab === "settings" && isTeacher && (
          <ClassroomSettingsTab
            classroomId={classroomId}
            name={classroom.name}
            description={classroom.description}
            inviteCode={classroom.inviteCode}
            onDeleted={() => navigate({ to: "/classrooms" })}
          />
        )}
      </div>
    </div>
  );
}
