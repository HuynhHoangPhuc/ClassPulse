import { useState, useEffect, useRef } from "react";
import { ChevronDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchApi } from "@/lib/fetch-api";
import type { Tag } from "@teaching/shared";

interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (ids: string[]) => void;
  token: string | null;
}

/**
 * Multi-select tag dropdown with inline tag creation.
 * Selected tags render as removable chips below the trigger.
 */
export function TagSelector({ selectedTagIds, onChange, token }: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchApi("/api/tags", {}, token)
      .then((data) => setTags(data as Tag[]))
      .catch(console.error);
  }, [token]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(id: string) {
    onChange(
      selectedTagIds.includes(id)
        ? selectedTagIds.filter((t) => t !== id)
        : [...selectedTagIds, id]
    );
  }

  async function createTag() {
    const name = newTagName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await fetchApi(
        "/api/tags",
        { method: "POST", body: JSON.stringify({ name }) },
        token
      ) as Tag;
      setTags((prev) => [...prev, created]);
      onChange([...selectedTagIds, created.id]);
      setNewTagName("");
    } catch (err) {
      console.error("Failed to create tag:", err);
    } finally {
      setCreating(false);
    }
  }

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));

  return (
    <div ref={ref} className="space-y-2">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-sm rounded-[var(--radius-card)] border transition-colors",
          open && "border-[var(--color-primary)]"
        )}
        style={{
          borderColor: open ? "var(--color-primary)" : "var(--color-border)",
          background: "var(--color-card)",
          color: "var(--color-foreground)",
        }}
      >
        <span style={{ color: selectedTagIds.length ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}>
          {selectedTagIds.length ? `${selectedTagIds.length} tag(s) selected` : "Select tags…"}
        </span>
        <ChevronDown
          size={14}
          className={cn("transition-transform", open && "rotate-180")}
          style={{ color: "var(--color-muted-foreground)" }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="rounded-[var(--radius-card)] border shadow-lg overflow-hidden z-20 relative"
          style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
        >
          <div className="max-h-48 overflow-y-auto">
            {tags.length === 0 && (
              <p className="px-3 py-2 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                No tags yet. Create one below.
              </p>
            )}
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={() => toggle(tag.id)}
                  className="rounded"
                />
                {tag.color && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: tag.color }}
                  />
                )}
                <span className="text-sm" style={{ color: "var(--color-foreground)" }}>
                  {tag.name}
                </span>
              </label>
            ))}
          </div>

          {/* Inline create */}
          <div
            className="flex items-center gap-2 px-3 py-2 border-t"
            style={{ borderColor: "var(--color-border)" }}
          >
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createTag())}
              placeholder="New tag name…"
              className="flex-1 text-sm bg-transparent outline-none"
              style={{ color: "var(--color-foreground)" }}
            />
            <button
              type="button"
              onClick={createTag}
              disabled={!newTagName.trim() || creating}
              className="p-1 rounded disabled:opacity-40"
              style={{ color: "var(--color-primary)" }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Selected chips */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
              style={{
                background: tag.color ? `${tag.color}22` : "var(--color-muted)",
                borderColor: tag.color ?? "var(--color-border)",
                color: tag.color ?? "var(--color-foreground)",
              }}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => toggle(tag.id)}
                className="hover:opacity-70 transition-opacity"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
