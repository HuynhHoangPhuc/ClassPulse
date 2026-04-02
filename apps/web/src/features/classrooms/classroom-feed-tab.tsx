import { useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { PostComposer } from "./post-composer";
import { PostCard } from "./post-card";

interface FeedPost {
  id: string;
  classroomId: string;
  type: string;
  title: string;
  content: string | null;
  authorName: string;
  authorAvatar: string | null;
  authorRole: string;
  createdAt: number;
  dueDate: number | null;
  assessment: { title: string; timeLimitMinutes: number | null } | null;
  commentCount: number;
}

interface ClassroomFeedTabProps {
  classroomId: string;
  isTeacher: boolean;
}

export function ClassroomFeedTab({ classroomId, isTeacher }: ClassroomFeedTabProps) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const currentUserId = user?.id ?? "";
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<string | undefined>();
  const [allPosts, setAllPosts] = useState<FeedPost[]>([]);

  const { data, isLoading } = useQuery<{ items: FeedPost[]; nextCursor: string | null }>({
    queryKey: ["classrooms", classroomId, "feed", cursor],
    queryFn: async () => {
      const t = await getToken();
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      const qs = params.toString();
      return fetchApi(`/api/classrooms/${classroomId}/feed${qs ? `?${qs}` : ""}`, {}, t) as Promise<{ items: FeedPost[]; nextCursor: string | null }>;
    },
    staleTime: 15_000,
  });

  const posts: FeedPost[] = cursor ? [...allPosts, ...(data?.items ?? [])] : (data?.items ?? []);

  async function handleCreatePost(postData: { type: string; title: string; content?: string; assessmentId?: string; dueDate?: number }) {
    const token = await getToken();
    await fetchApi(`/api/classrooms/${classroomId}/posts`, {
      method: "POST",
      body: JSON.stringify(postData),
    }, token);
    queryClient.invalidateQueries({ queryKey: ["classrooms", classroomId, "feed"] });
    setCursor(undefined);
    setAllPosts([]);
  }

  return (
    <div className="space-y-4">
      {/* Composer (teacher only) */}
      {isTeacher && (
        <PostComposer classroomId={classroomId} onSubmit={handleCreatePost} />
      )}

      {/* Loading */}
      {isLoading && posts.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 animate-pulse space-y-2" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}>
              <div className="h-3 rounded w-1/3" style={{ background: "var(--color-muted)" }} />
              <div className="h-3 rounded w-2/3" style={{ background: "var(--color-muted)" }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && posts.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: "var(--color-muted-foreground)" }}>
          No posts yet. {isTeacher ? "Create the first post above." : "Check back later."}
        </p>
      )}

      {/* Post list */}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} isTeacher={isTeacher} />
      ))}

      {/* Load more */}
      {data?.nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => { setAllPosts(posts); setCursor(data.nextCursor!); }}
            className="px-4 py-2 text-sm rounded-xl border hover:bg-[var(--color-muted)]"
            style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
