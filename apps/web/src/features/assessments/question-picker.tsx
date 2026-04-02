import { useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { Search, GripVertical, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Question, Tag } from "@teaching/shared";

type QuestionWithTags = Question & { tags: Tag[] };

interface QuestionPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function QuestionPicker({ selected, onChange }: QuestionPickerProps) {
  const { getToken } = useAuth();
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const { data } = useQuery<{ items: QuestionWithTags[] }>({
    queryKey: ["questions", "picker", debouncedSearch],
    queryFn: async () => {
      const t = await getToken();
      const params = new URLSearchParams({ limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      return fetchApi(`/api/questions?${params}`, {}, t) as Promise<{ items: QuestionWithTags[] }>;
    },
    staleTime: 30_000,
  });

  const questions = data?.items ?? [];
  const selectedSet = new Set(selected);

  function toggleQuestion(id: string) {
    if (selectedSet.has(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function removeQuestion(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  return (
    <div className="space-y-3">
      {/* Selected count */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
          {selected.length} question{selected.length !== 1 ? "s" : ""} selected
        </span>
      </div>

      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id, idx) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
              style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)", background: "var(--color-primary)/5" }}
            >
              <GripVertical size={10} />
              Q{idx + 1}
              <button type="button" onClick={() => removeQuestion(id)} className="hover:opacity-70">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        <Search size={14} style={{ color: "var(--color-muted-foreground)" }} />
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search questions…"
          className="bg-transparent outline-none flex-1"
          style={{ color: "var(--color-foreground)" }}
        />
      </div>

      {/* Question list */}
      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        {questions.map((q) => {
          const isSelected = selectedSet.has(q.id);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => toggleQuestion(q.id)}
              className="w-full flex items-start gap-3 p-3 rounded-xl border text-left text-sm transition-colors"
              style={{
                borderColor: isSelected ? "var(--color-primary)" : "var(--color-border)",
                background: isSelected ? "color-mix(in srgb, var(--color-primary) 5%, var(--color-card))" : "var(--color-card)",
              }}
            >
              {/* Checkbox indicator */}
              <div
                className="w-4 h-4 mt-0.5 rounded border-2 shrink-0 flex items-center justify-center"
                style={{
                  borderColor: isSelected ? "var(--color-primary)" : "var(--color-border)",
                  background: isSelected ? "var(--color-primary)" : "transparent",
                }}
              >
                {isSelected && <span className="text-white text-[10px]">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="line-clamp-2" style={{ color: "var(--color-foreground)" }}>
                  {q.content.replace(/[#*_`]/g, "").slice(0, 120)}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  {q.tags.map((tag) => (
                    <Badge key={tag.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {tag.name}
                    </Badge>
                  ))}
                  <span className="text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
                    L{q.complexity}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
        {questions.length === 0 && (
          <p className="text-sm text-center py-4" style={{ color: "var(--color-muted-foreground)" }}>
            No questions found
          </p>
        )}
      </div>
    </div>
  );
}
