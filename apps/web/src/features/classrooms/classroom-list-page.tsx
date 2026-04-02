import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Users, X, Copy } from "lucide-react";
import { ClassroomCard } from "./classroom-card";

interface ClassroomItem {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  inviteCode: string;
  userRole?: string;
}

export function ClassroomListPage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: ClassroomItem[] }>({
    queryKey: ["classrooms"],
    queryFn: async () => {
      const t = await getToken();
      return fetchApi("/api/classrooms", {}, t) as Promise<{ items: ClassroomItem[] }>;
    },
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return fetchApi("/api/classrooms", {
        method: "POST",
        body: JSON.stringify({ name: newName, description: newDesc || null }),
      }, token) as Promise<ClassroomItem>;
    },
    onSuccess: (classroom) => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      setCreatedCode(classroom.inviteCode);
      setNewName("");
      setNewDesc("");
    },
  });

  const items = data?.items ?? [];

  const actions = (
    <button
      type="button"
      onClick={() => setShowCreate(true)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-card)] text-sm font-medium transition-opacity hover:opacity-90"
      style={{ background: "var(--color-primary)", color: "#fff" }}
    >
      <Plus size={14} /> New Classroom
    </button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Classrooms"
        description="Manage your classrooms and students."
        actions={actions}
      />

      {/* Create dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setShowCreate(false); setCreatedCode(null); }} />
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl border p-6 space-y-4 shadow-xl"
            style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
          >
            {createdCode ? (
              /* Success: show invite code */
              <>
                <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}>
                  Classroom Created!
                </h3>
                <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>Share this invite code:</p>
                <div className="flex items-center gap-2">
                  <code
                    className="px-4 py-2 rounded-xl border text-lg font-mono tracking-widest flex-1 text-center"
                    style={{ borderColor: "var(--color-border)", background: "var(--color-muted)", color: "var(--color-foreground)" }}
                  >
                    {createdCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(createdCode)}
                    className="p-2 rounded-lg hover:bg-[var(--color-muted)]"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreatedCode(null); }}
                  className="w-full py-2 rounded-xl text-sm font-medium"
                  style={{ background: "var(--color-primary)", color: "#fff" }}
                >
                  Done
                </button>
              </>
            ) : (
              /* Create form */
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}>
                    Create Classroom
                  </h3>
                  <button type="button" onClick={() => setShowCreate(false)} style={{ color: "var(--color-muted-foreground)" }}>
                    <X size={18} />
                  </button>
                </div>
                <label className="block space-y-1">
                  <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Name *</span>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Math 101"
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:border-[var(--color-primary)]"
                    style={{ borderColor: "var(--color-border)", background: "var(--color-background)", color: "var(--color-foreground)" }}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Description</span>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Optional description…"
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none focus:border-[var(--color-primary)]"
                    style={{ borderColor: "var(--color-border)", background: "var(--color-background)", color: "var(--color-foreground)" }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !newName.trim()}
                  className="w-full py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--color-primary)", color: "#fff" }}
                >
                  {createMutation.isPending ? "Creating…" : "Create Classroom"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[var(--radius-card)] border p-5 animate-pulse space-y-2" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}>
              <div className="h-3 rounded w-2/3" style={{ background: "var(--color-muted)" }} />
              <div className="h-3 rounded w-1/3" style={{ background: "var(--color-muted)" }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={<Users size={40} />}
          headline="No classrooms yet"
          description="Create your first classroom to start organising students."
          action={
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-card)] text-sm font-medium"
              style={{ background: "var(--color-primary)", color: "#fff" }}
            >
              <Plus size={14} /> Create your first classroom
            </button>
          }
        />
      )}

      {/* Grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c) => (
            <ClassroomCard
              key={c.id}
              classroom={c}
              onClick={() => navigate({ to: "/classrooms/$classroomId", params: { classroomId: c.id } })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
