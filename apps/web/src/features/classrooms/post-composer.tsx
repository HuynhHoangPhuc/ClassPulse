import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { Send } from "lucide-react";

type PostType = "announcement" | "assessment_assignment";

interface PostComposerProps {
  classroomId: string;
  onSubmit: (data: { type: PostType; title: string; content?: string; assessmentId?: string; dueDate?: number }) => Promise<void>;
}

interface AssessmentOption {
  id: string;
  title: string;
}

export function PostComposer({ classroomId, onSubmit }: PostComposerProps) {
  const { getToken } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [type, setType] = useState<PostType>("announcement");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: assessmentsData } = useQuery<{ items: AssessmentOption[] }>({
    queryKey: ["assessments", "picker"],
    queryFn: async () => {
      const t = await getToken();
      return fetchApi("/api/assessments?limit=50", {}, t) as Promise<{ items: AssessmentOption[] }>;
    },
    enabled: type === "assessment_assignment",
    staleTime: 60_000,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        type,
        title,
        content: type === "announcement" ? content : undefined,
        assessmentId: type === "assessment_assignment" ? assessmentId : undefined,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      });
      setTitle("");
      setContent("");
      setAssessmentId("");
      setDueDate("");
      setExpanded(false);
    } finally {
      setLoading(false);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)]"
        style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)", background: "var(--color-card)" }}
      >
        Create a new post…
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: "var(--color-primary)/30", background: "var(--color-card)" }}
    >
      {/* Type toggle */}
      <div className="flex gap-2">
        {(["announcement", "assessment_assignment"] as PostType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
            style={{
              borderColor: type === t ? "var(--color-primary)" : "var(--color-border)",
              background: type === t ? "var(--color-primary)" : "transparent",
              color: type === t ? "#fff" : "var(--color-muted-foreground)",
            }}
          >
            {t === "announcement" ? "Announcement" : "Assessment"}
          </button>
        ))}
      </div>

      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Post title…"
        required
        className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:border-[var(--color-primary)]"
        style={{ borderColor: "var(--color-border)", background: "var(--color-background)", color: "var(--color-foreground)" }}
      />

      {/* Announcement content */}
      {type === "announcement" && (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your announcement…"
          rows={3}
          className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none focus:border-[var(--color-primary)]"
          style={{ borderColor: "var(--color-border)", background: "var(--color-background)", color: "var(--color-foreground)" }}
        />
      )}

      {/* Assessment assignment fields */}
      {type === "assessment_assignment" && (
        <div className="grid grid-cols-2 gap-3">
          <select
            value={assessmentId}
            onChange={(e) => setAssessmentId(e.target.value)}
            required
            className="px-3 py-2 rounded-xl border text-sm outline-none"
            style={{ borderColor: "var(--color-border)", background: "var(--color-background)", color: "var(--color-foreground)" }}
          >
            <option value="">Select assessment…</option>
            {(assessmentsData?.items ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2 rounded-xl border text-sm outline-none"
            style={{ borderColor: "var(--color-border)", background: "var(--color-background)", color: "var(--color-foreground)" }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-[var(--color-muted)]"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !title}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--color-primary)", color: "#fff" }}
        >
          <Send size={12} />
          {loading ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
