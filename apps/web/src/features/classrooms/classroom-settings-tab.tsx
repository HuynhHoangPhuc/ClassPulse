import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { Copy, RefreshCw, Trash2 } from "lucide-react";

interface ClassroomSettingsTabProps {
  classroomId: string;
  name: string;
  description: string | null;
  inviteCode: string;
  onDeleted: () => void;
}

export function ClassroomSettingsTab({ classroomId, name, description, inviteCode, onDeleted }: ClassroomSettingsTabProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [editName, setEditName] = useState(name);
  const [editDesc, setEditDesc] = useState(description ?? "");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return fetchApi(`/api/classrooms/${classroomId}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName, description: editDesc || null }),
      }, token);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classrooms", classroomId] }),
  });

  const regenMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return fetchApi(`/api/classrooms/${classroomId}/regenerate-code`, { method: "POST" }, token);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classrooms", classroomId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return fetchApi(`/api/classrooms/${classroomId}`, { method: "DELETE" }, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      onDeleted();
    },
  });

  function handleCopy() {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Edit name/description */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>Classroom Details</h4>
        <label className="block space-y-1">
          <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Name</span>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:border-[var(--color-primary)]"
            style={{ borderColor: "var(--color-border)", background: "var(--color-background)", color: "var(--color-foreground)" }}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Description</span>
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none focus:border-[var(--color-primary)]"
            style={{ borderColor: "var(--color-border)", background: "var(--color-background)", color: "var(--color-foreground)" }}
          />
        </label>
        <button
          type="button"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !editName.trim()}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--color-primary)", color: "#fff" }}
        >
          {updateMutation.isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* Invite code */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>Invite Code</h4>
        <div className="flex items-center gap-2">
          <code
            className="px-4 py-2 rounded-xl border text-sm font-mono tracking-widest"
            style={{ borderColor: "var(--color-border)", background: "var(--color-muted)", color: "var(--color-foreground)" }}
          >
            {inviteCode}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="p-2 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
            style={{ color: "var(--color-muted-foreground)" }}
            title="Copy code"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={() => regenMutation.mutate()}
            disabled={regenMutation.isPending}
            className="p-2 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
            style={{ color: "var(--color-muted-foreground)" }}
            title="Regenerate code"
          >
            <RefreshCw size={14} className={regenMutation.isPending ? "animate-spin" : ""} />
          </button>
          {copied && <span className="text-xs" style={{ color: "var(--color-success)" }}>Copied!</span>}
        </div>
      </div>

      {/* Danger zone */}
      <div className="space-y-2 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
        <h4 className="text-sm font-semibold" style={{ color: "var(--color-destructive)" }}>Danger Zone</h4>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition-colors hover:bg-[var(--color-destructive)]/5"
            style={{ borderColor: "var(--color-destructive)", color: "var(--color-destructive)" }}
          >
            <Trash2 size={14} /> Archive Classroom
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: "var(--color-destructive)" }}>Are you sure?</span>
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: "var(--color-destructive)", color: "#fff" }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Yes, Archive"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-lg text-sm hover:bg-[var(--color-muted)]"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
