import { useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { Plus, ClipboardList, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchApi } from "@/lib/fetch-api";
import { ASSESSMENT_TYPES } from "@teaching/shared";
import { AssessmentCard } from "./assessment-card";

interface AssessmentItem {
  id: string;
  title: string;
  type: string;
  timeLimitMinutes: number | null;
  questionCount: number;
  createdAt: number;
}

interface AssessmentsResponse {
  items: AssessmentItem[];
  nextCursor: string | null;
}

export function AssessmentListPage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [allItems, setAllItems] = useState<AssessmentItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setCursor(undefined);
      setAllItems([]);
    }, 300);
  }, []);

  const { data, isLoading, isError } = useQuery<AssessmentsResponse>({
    queryKey: ["assessments", typeFilter, search, cursor],
    queryFn: async () => {
      const t = await getToken();
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (search) params.set("search", search);
      if (cursor) params.set("cursor", cursor);
      const qs = params.toString();
      return fetchApi(`/api/assessments${qs ? `?${qs}` : ""}`, {}, t) as Promise<AssessmentsResponse>;
    },
    staleTime: 30_000,
  });

  const items: AssessmentItem[] = cursor ? [...allItems, ...(data?.items ?? [])] : (data?.items ?? []);

  function handleLoadMore() {
    if (data?.nextCursor) {
      setAllItems(items);
      setCursor(data.nextCursor);
    }
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    await fetchApi(`/api/assessments/${id}`, { method: "DELETE" }, token);
    queryClient.invalidateQueries({ queryKey: ["assessments"] });
    setCursor(undefined);
    setAllItems([]);
  }

  async function handleDuplicate(id: string) {
    const token = await getToken();
    await fetchApi(`/api/assessments/${id}/duplicate`, { method: "POST" }, token);
    queryClient.invalidateQueries({ queryKey: ["assessments"] });
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
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search assessments…"
          className="bg-transparent outline-none w-40"
          style={{ color: "var(--color-foreground)" }}
        />
      </div>

      <Link
        to="/assessments/new"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-card)] text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: "var(--color-primary)", color: "#fff" }}
      >
        <Plus size={14} />
        New Assessment
      </Link>
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assessment Bank"
        description="Create, manage, and auto-generate assessments."
        actions={actions}
      />

      {/* Type filter tabs */}
      <div className="flex gap-1">
        {["all", ...ASSESSMENT_TYPES].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTypeFilter(t); setCursor(undefined); setAllItems([]); }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors"
            style={{
              background: typeFilter === t ? "var(--color-primary)" : "transparent",
              color: typeFilter === t ? "#fff" : "var(--color-muted-foreground)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Error */}
      {isError && (
        <p className="text-sm" style={{ color: "var(--color-destructive)" }}>Failed to load assessments.</p>
      )}

      {/* Loading */}
      {isLoading && items.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[var(--radius-card)] border p-5 animate-pulse space-y-2"
              style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
            >
              <div className="h-3 rounded" style={{ background: "var(--color-muted)", width: "70%" }} />
              <div className="h-3 rounded" style={{ background: "var(--color-muted)", width: "40%" }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={<ClipboardList size={40} />}
          headline="No assessments yet"
          description="Create your first assessment to start testing students."
          action={
            <Link
              to="/assessments/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-card)] text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: "var(--color-primary)", color: "#fff" }}
            >
              <Plus size={14} />
              Create your first assessment
            </Link>
          }
        />
      )}

      {/* Grid */}
      {items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((a) => (
              <AssessmentCard
                key={a.id}
                assessment={a}
                onEdit={() => navigate({ to: "/assessments/$assessmentId/edit", params: { assessmentId: a.id } })}
                onPreview={() => navigate({ to: "/assessments/$assessmentId/preview", params: { assessmentId: a.id } })}
                onDuplicate={() => handleDuplicate(a.id)}
                onDelete={() => handleDelete(a.id)}
              />
            ))}
          </div>

          {data?.nextCursor && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoading}
                className="px-4 py-2 text-sm rounded-[var(--radius-card)] border transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)", background: "var(--color-card)" }}
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
