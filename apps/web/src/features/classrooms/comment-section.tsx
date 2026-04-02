import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { fetchApi } from "@/lib/fetch-api";
import { CommentInput } from "./comment-input";
import { CommentItem } from "./comment-item";

interface CommentData {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorRole: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  parentCommentId: string | null;
}

interface CommentSectionProps {
  postId: string;
  classroomId: string;
  commentCount: number;
  currentUserId: string;
  isTeacher: boolean;
}

export function CommentSection({ postId, classroomId, commentCount, currentUserId, isTeacher }: CommentSectionProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery<{ items: CommentData[] }>({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const token = await getToken();
      return fetchApi(`/api/posts/${postId}/comments`, {}, token) as Promise<{ items: CommentData[] }>;
    },
    enabled: expanded,
    staleTime: 15_000,
  });

  const allComments = data?.items ?? [];
  const topLevel = allComments.filter((c) => !c.parentCommentId);
  const replies = allComments.filter((c) => c.parentCommentId);

  function getReplies(parentId: string) {
    return replies.filter((r) => r.parentCommentId === parentId);
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    // Also refresh feed to update comment count
    queryClient.invalidateQueries({ queryKey: ["classrooms", classroomId, "feed"] });
  }

  async function handleCreate(content: string, mentionUserIds: string[]) {
    try {
      const token = await getToken();
      await fetchApi(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content, mentionUserIds }),
      }, token);
      invalidate();
    } catch (err) {
      console.error("Failed to create comment:", err);
    }
  }

  async function handleReply(parentId: string, content: string, mentionUserIds: string[]) {
    try {
      const token = await getToken();
      await fetchApi(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content, parentCommentId: parentId, mentionUserIds }),
      }, token);
      invalidate();
    } catch (err) {
      console.error("Failed to reply:", err);
    }
  }

  async function handleEdit(commentId: string, content: string, mentionUserIds: string[]) {
    try {
      const token = await getToken();
      await fetchApi(`/api/comments/${commentId}`, {
        method: "PUT",
        body: JSON.stringify({ content, mentionUserIds }),
      }, token);
      invalidate();
    } catch (err) {
      console.error("Failed to edit comment:", err);
    }
  }

  async function handleDelete(commentId: string) {
    try {
      const token = await getToken();
      await fetchApi(`/api/comments/${commentId}`, { method: "DELETE" }, token);
      invalidate();
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  }

  return (
    <div className="border-t pt-3 mt-3" style={{ borderColor: "var(--color-border)" }}>
      {/* Toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        <MessageSquare size={12} />
        {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? "s" : ""}` : "Comment"}
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Loading */}
          {isLoading && (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-2 animate-pulse">
                  <div className="w-7 h-7 rounded-full" style={{ background: "var(--color-muted)" }} />
                  <div className="flex-1 space-y-1">
                    <div className="h-2.5 rounded w-24" style={{ background: "var(--color-muted)" }} />
                    <div className="h-2.5 rounded w-48" style={{ background: "var(--color-muted)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comments */}
          {topLevel.map((comment) => (
            <div key={comment.id} className="space-y-2">
              <CommentItem
                comment={comment}
                classroomId={classroomId}
                currentUserId={currentUserId}
                isTeacher={isTeacher}
                onReply={handleReply}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              {getReplies(comment.id).map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  classroomId={classroomId}
                  currentUserId={currentUserId}
                  isTeacher={isTeacher}
                  isReply
                  onReply={handleReply}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ))}

          {/* New comment input */}
          <CommentInput classroomId={classroomId} onSubmit={handleCreate} />
        </div>
      )}
    </div>
  );
}
