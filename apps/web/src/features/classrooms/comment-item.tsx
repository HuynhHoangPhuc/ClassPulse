import { useState } from "react";
import { Reply, Pencil, Trash2, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MentionRenderer } from "./mention-renderer";
import { CommentInput } from "./comment-input";

interface CommentData {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorRole: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  parentCommentId: string | null;
}

interface CommentItemProps {
  comment: CommentData;
  classroomId: string;
  currentUserId: string;
  isTeacher: boolean;
  isReply?: boolean;
  onReply: (parentId: string, content: string, mentionUserIds: string[]) => Promise<void>;
  onEdit: (commentId: string, content: string, mentionUserIds: string[]) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
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

export function CommentItem({
  comment,
  classroomId,
  currentUserId,
  isTeacher,
  isReply = false,
  onReply,
  onEdit,
  onDelete,
}: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isAuthor = comment.authorId === currentUserId;
  const canDelete = isAuthor || isTeacher;
  const isDeleted = comment.content === "[deleted]";
  const wasEdited = comment.updatedAt > comment.createdAt + 1000;

  async function handleEditSave() {
    if (!editContent.trim()) return;
    // Extract mention IDs from edited content
    const mentionRegex = /@\[[^\]]*\]\(([^)]+)\)/g;
    const ids: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = mentionRegex.exec(editContent)) !== null) ids.push(m[1]);
    await onEdit(comment.id, editContent, ids);
    setEditing(false);
  }

  return (
    <div className={`flex gap-2 ${isReply ? "ml-10" : ""}`}>
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
        style={{ background: "var(--color-primary)", color: "#fff" }}
      >
        {comment.authorName.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium" style={{ color: "var(--color-foreground)" }}>
            {comment.authorName}
          </span>
          <Badge variant="secondary" className="text-[9px] px-1 py-0">
            {comment.authorRole}
          </Badge>
          <span className="text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
            {timeAgo(comment.createdAt)}
          </span>
          {wasEdited && !isDeleted && (
            <span className="text-[10px] italic" style={{ color: "var(--color-muted-foreground)" }}>
              (edited)
            </span>
          )}
        </div>

        {/* Content */}
        {editing ? (
          <div className="mt-1 space-y-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 rounded-lg border text-sm outline-none resize-none focus:border-[var(--color-primary)]"
              style={{ borderColor: "var(--color-border)", background: "var(--color-background)", color: "var(--color-foreground)" }}
            />
            <div className="flex gap-1">
              <button type="button" onClick={handleEditSave} className="p-1 rounded hover:bg-[var(--color-muted)]">
                <Check size={12} style={{ color: "var(--color-primary)" }} />
              </button>
              <button type="button" onClick={() => { setEditing(false); setEditContent(comment.content); }} className="p-1 rounded hover:bg-[var(--color-muted)]">
                <X size={12} style={{ color: "var(--color-muted-foreground)" }} />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm mt-0.5" style={{ color: isDeleted ? "var(--color-muted-foreground)" : "var(--color-foreground)" }}>
            {isDeleted ? (
              <span className="italic">[deleted]</span>
            ) : (
              <MentionRenderer content={comment.content} />
            )}
          </div>
        )}

        {/* Actions */}
        {!editing && !isDeleted && (
          <div className="flex items-center gap-2 mt-1">
            {!isReply && (
              <button
                type="button"
                onClick={() => setShowReply(!showReply)}
                className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--color-muted)] transition-colors"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                <Reply size={10} /> Reply
              </button>
            )}
            {isAuthor && (
              <button
                type="button"
                onClick={() => { setEditing(true); setEditContent(comment.content); }}
                className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--color-muted)] transition-colors"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                <Pencil size={10} /> Edit
              </button>
            )}
            {canDelete && (
              confirmDelete ? (
                <span className="flex items-center gap-1 text-[10px]">
                  <span style={{ color: "var(--color-destructive)" }}>Delete?</span>
                  <button type="button" onClick={() => { onDelete(comment.id); setConfirmDelete(false); }} className="text-[10px] font-medium underline" style={{ color: "var(--color-destructive)" }}>
                    Yes
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
                    No
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--color-muted)] transition-colors"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  <Trash2 size={10} /> Delete
                </button>
              )
            )}
          </div>
        )}

        {/* Inline reply input */}
        {showReply && (
          <div className="mt-2">
            <CommentInput
              classroomId={classroomId}
              placeholder="Write a reply…"
              onSubmit={async (content, mentionIds) => {
                await onReply(comment.id, content, mentionIds);
                setShowReply(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
