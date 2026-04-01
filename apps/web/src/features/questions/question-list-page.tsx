import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { LayoutList, LayoutGrid, SlidersHorizontal, Plus, BookOpen, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { fetchApi } from "@/lib/fetch-api";
import { QuestionCard } from "./question-card";
import { QuestionFilterPanel, type FilterState } from "./question-filter-panel";
import type { Question, Tag } from "@teaching/shared";

type ViewMode = "list" | "grid";

type QuestionWithTags = Question & { tags: Tag[] };

interface QuestionsResponse {
  items: QuestionWithTags[];
  nextCursor: string | null;
}

const DEFAULT_FILTERS: FilterState = {
  tagIds: [],
  complexityMin: 1,
  complexityMax: 5,
  complexityType: "",
  search: "",
};

function buildQueryParams(filters: FilterState, cursor?: string) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.tagIds.length) params.set("tagIds", filters.tagIds.join(","));
  if (filters.complexityMin !== 1) params.set("complexityMin", String(filters.complexityMin));
  if (filters.complexityMax !== 5) params.set("complexityMax", String(filters.complexityMax));
  if (filters.complexityType) params.set("complexityType", filters.complexityType);
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

/** Skeleton card placeholder shown while loading */
function SkeletonCard({ view }: { view: ViewMode }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border p-5 animate-pulse",
        view === "list" ? "flex gap-3" : "flex flex-col gap-2"
      )}
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded" style={{ background: "var(--color-muted)", width: "80%" }} />
        <div className="h-3 rounded" style={{ background: "var(--color-muted)", width: "55%" }} />
        <div className="flex gap-1 mt-1">
          <div className="h-4 w-12 rounded-full" style={{ background: "var(--color-muted)" }} />
          <div className="h-4 w-16 rounded-full" style={{ background: "var(--color-muted)" }} />
        </div>
      </div>
    </div>
  );
}

export function QuestionListPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("list");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [cursor, setCursor] = useState<string | undefined>();
  const [allQuestions, setAllQuestions] = useState<QuestionWithTags[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch token once for filter panel's TagSelector
  useEffect(() => {
    getToken().then(setToken).catch(console.error);
  }, [getToken]);

  // Debounced search — updates filters.search after 300ms idle
  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleFiltersChange({ ...filters, search: value });
    }, 300);
  }, [filters]);

  const queryKey = ["questions", filters, cursor];

  const { data, isLoading, isError } = useQuery<QuestionsResponse>({
    queryKey,
    queryFn: async () => {
      const t = await getToken();
      const qs = buildQueryParams(filters, cursor);
      return fetchApi(`/api/questions${qs ? `?${qs}` : ""}`, {}, t) as Promise<QuestionsResponse>;
    },
    staleTime: 30_000,
  });

  // Merge paginated results
  const questions: QuestionWithTags[] = cursor
    ? [...allQuestions, ...(data?.items ?? [])]
    : (data?.items ?? []);

  function handleLoadMore() {
    if (data?.nextCursor) {
      setAllQuestions(questions);
      setCursor(data.nextCursor);
    }
  }

  function handleFiltersChange(next: FilterState) {
    setFilters(next);
    setCursor(undefined);
    setAllQuestions([]);
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    await fetchApi(`/api/questions/${id}`, { method: "DELETE" }, token);
    queryClient.invalidateQueries({ queryKey: ["questions"] });
    setCursor(undefined);
    setAllQuestions([]);
  }

  const actions = (
    <>
      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-card)] border text-sm"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <Search size={14} style={{ color: "var(--color-muted-foreground)" }} />
        <input
          value={searchInput}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder="Search questions…"
          className="bg-transparent outline-none w-40"
          style={{ color: "var(--color-foreground)" }}
        />
      </div>

      {/* Filter toggle */}
      <button
        type="button"
        onClick={() => setShowFilters((v) => !v)}
        className={cn(
          "p-2 rounded-[var(--radius-card)] border transition-colors",
          showFilters && "border-[var(--color-primary)]"
        )}
        style={{
          borderColor: showFilters ? "var(--color-primary)" : "var(--color-border)",
          color: showFilters ? "var(--color-primary)" : "var(--color-muted-foreground)",
          background: "var(--color-card)",
        }}
        title="Toggle filters"
      >
        <SlidersHorizontal size={16} />
      </button>

      {/* View toggle */}
      <div
        className="flex rounded-[var(--radius-card)] border overflow-hidden"
        style={{ borderColor: "var(--color-border)" }}
      >
        {(["list", "grid"] as ViewMode[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className="p-2 transition-colors"
            style={{
              background: view === v ? "var(--color-primary)" : "var(--color-card)",
              color: view === v ? "#fff" : "var(--color-muted-foreground)",
            }}
            title={v === "list" ? "List view" : "Grid view"}
          >
            {v === "list" ? <LayoutList size={16} /> : <LayoutGrid size={16} />}
          </button>
        ))}
      </div>

      {/* New question */}
      <Link
        to="/questions/new"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-card)] text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: "var(--color-primary)", color: "#fff" }}
      >
        <Plus size={14} />
        New Question
      </Link>
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Question Bank"
        description="Build, tag, and manage your reusable question library."
        actions={actions}
      />

      {/* Filter panel */}
      <QuestionFilterPanel
        filters={filters}
        onChange={handleFiltersChange}
        token={token}
        open={showFilters}
        onToggle={() => setShowFilters((v) => !v)}
      />

      {/* Error state */}
      {isError && (
        <p className="text-sm" style={{ color: "var(--color-destructive)" }}>
          Failed to load questions. Please try again.
        </p>
      )}

      {/* Loading skeletons */}
      {isLoading && questions.length === 0 && (
        <div className={cn(view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-3")}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} view={view} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && questions.length === 0 && (
        <EmptyState
          icon={<BookOpen size={40} />}
          headline="No questions yet"
          description="Create your first question to start building your question bank."
          action={
            <Link
              to="/questions/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-card)] text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: "var(--color-primary)", color: "#fff" }}
            >
              <Plus size={14} />
              Create your first question
            </Link>
          }
        />
      )}

      {/* Question grid/list */}
      {questions.length > 0 && (
        <>
          <div
            className={cn(
              view === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                : "flex flex-col gap-3"
            )}
          >
            {questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                view={view}
                onEdit={() => navigate({ to: "/questions/$questionId/edit", params: { questionId: q.id } })}
                onDelete={() => handleDelete(q.id)}
              />
            ))}
          </div>

          {/* Load more */}
          {data?.nextCursor && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoading}
                className="px-4 py-2 text-sm rounded-[var(--radius-card)] border transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-foreground)",
                  background: "var(--color-card)",
                }}
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
