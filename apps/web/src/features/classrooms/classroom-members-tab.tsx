import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { AddMemberDialog } from "./add-member-dialog";

interface Member {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
}

interface ClassroomMembersTabProps {
  classroomId: string;
  isTeacher: boolean;
}

const ROLE_ORDER = ["teacher", "student", "parent"];
const roleBadgeVariant: Record<string, "default" | "secondary" | "warning"> = {
  teacher: "default",
  student: "secondary",
  parent: "warning",
};

export function ClassroomMembersTab({ classroomId, isTeacher }: ClassroomMembersTabProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data, isLoading } = useQuery<{ items: Member[] }>({
    queryKey: ["classrooms", classroomId, "members"],
    queryFn: async () => {
      const t = await getToken();
      return fetchApi(`/api/classrooms/${classroomId}/members`, {}, t) as Promise<{ items: Member[] }>;
    },
    staleTime: 30_000,
  });

  const members = data?.items ?? [];

  // Group by role
  const grouped = ROLE_ORDER.map((role) => ({
    role,
    members: members.filter((m) => m.role === role),
  })).filter((g) => g.members.length > 0);

  async function handleAddMember(email: string, role: string) {
    const token = await getToken();
    await fetchApi(`/api/classrooms/${classroomId}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }, token);
    queryClient.invalidateQueries({ queryKey: ["classrooms", classroomId, "members"] });
  }

  async function handleRemoveMember(userId: string) {
    const token = await getToken();
    await fetchApi(`/api/classrooms/${classroomId}/members/${userId}`, {
      method: "DELETE",
    }, token);
    queryClient.invalidateQueries({ queryKey: ["classrooms", classroomId, "members"] });
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      {isTeacher && (
        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--color-primary)", color: "#fff" }}
        >
          <Plus size={14} /> Add Member
        </button>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--color-muted)" }} />
          ))}
        </div>
      )}

      {/* Grouped member list */}
      {grouped.map((group) => (
        <div key={group.role} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>
            {group.role}s ({group.members.length})
          </h4>
          {group.members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
              style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "var(--color-primary)", color: "#fff" }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--color-foreground)" }}>
                  {member.name}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--color-muted-foreground)" }}>
                  {member.email}
                </p>
              </div>
              <Badge variant={roleBadgeVariant[member.role] ?? "default"}>{member.role}</Badge>
              {isTeacher && member.role !== "teacher" && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.userId)}
                  className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
                  style={{ color: "var(--color-destructive)" }}
                  title="Remove member"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      ))}

      <AddMemberDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSubmit={handleAddMember}
      />
    </div>
  );
}
