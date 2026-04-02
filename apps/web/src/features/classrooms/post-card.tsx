import { Badge } from "@/components/ui/badge";
import { Clock, FileText } from "lucide-react";

interface PostCardProps {
  post: {
    id: string;
    type: string;
    title: string;
    content: string | null;
    authorName: string;
    authorAvatar: string | null;
    authorRole: string;
    createdAt: number;
    dueDate: number | null;
    assessment: { title: string; timeLimitMinutes: number | null } | null;
  };
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function PostCard({ post }: PostCardProps) {
  const isAssignment = post.type === "assessment_assignment";

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      {/* Author header */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: "var(--color-primary)", color: "#fff" }}
        >
          {post.authorName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate" style={{ color: "var(--color-foreground)" }}>
              {post.authorName}
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {post.authorRole}
            </Badge>
          </div>
          <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
            {timeAgo(post.createdAt)}
          </span>
        </div>
      </div>

      {/* Post title */}
      <h4 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
        {post.title}
      </h4>

      {/* Content (announcement) */}
      {post.content && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-foreground)" }}>
          {post.content}
        </p>
      )}

      {/* Assessment assignment card */}
      {isAssignment && post.assessment && (
        <div
          className="rounded-lg border p-3 flex items-center gap-3"
          style={{ borderColor: "var(--color-primary)/20", background: "color-mix(in srgb, var(--color-primary) 5%, var(--color-card))" }}
        >
          <FileText size={20} style={{ color: "var(--color-primary)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
              {post.assessment.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {post.assessment.timeLimitMinutes && (
                <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                  <Clock size={10} />
                  {post.assessment.timeLimitMinutes} min
                </span>
              )}
              {post.dueDate && (
                <span className="text-xs" style={{ color: "var(--color-warning)" }}>
                  Due {new Date(post.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
