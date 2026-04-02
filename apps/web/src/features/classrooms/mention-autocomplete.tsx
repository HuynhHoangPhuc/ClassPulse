import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { fetchApi } from "@/lib/fetch-api";

interface MemberResult {
  userId: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

interface MentionAutocompleteProps {
  classroomId: string;
  query: string;
  onSelect: (member: MemberResult) => void;
  onClose: () => void;
  visible: boolean;
}

export function MentionAutocomplete({ classroomId, query, onSelect, onClose, visible }: MentionAutocompleteProps) {
  const { getToken } = useAuth();
  const [results, setResults] = useState<MemberResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!visible || !query) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const token = await getToken();
      const data = (await fetchApi(
        `/api/classrooms/${classroomId}/members/search?q=${encodeURIComponent(query)}`,
        {},
        token,
      )) as { items: MemberResult[] };
      setResults(data.items);
      setActiveIndex(0);
    }, 200);

    return () => clearTimeout(debounceRef.current);
  }, [query, visible, classroomId, getToken]);

  if (!visible || results.length === 0) return null;

  return (
    <div
      className="absolute z-50 mt-1 w-64 max-h-48 overflow-y-auto rounded-xl border shadow-lg"
      style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
    >
      {results.map((member, i) => (
        <button
          key={member.userId}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // prevent blur before click fires
            onSelect(member);
          }}
          onMouseEnter={() => setActiveIndex(i)}
          className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors"
          style={{
            background: i === activeIndex ? "var(--color-muted)" : "transparent",
            color: "var(--color-foreground)",
          }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ background: "var(--color-primary)", color: "#fff" }}
          >
            {member.name.charAt(0).toUpperCase()}
          </div>
          <span className="truncate">{member.name}</span>
          <span className="text-[10px] ml-auto" style={{ color: "var(--color-muted-foreground)" }}>
            {member.role}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Hook to manage @mention state in a textarea */
export function useMentionDetection(value: string, cursorPos: number) {
  // Find the @mention query at cursor position
  const textBeforeCursor = value.slice(0, cursorPos);
  const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

  return {
    active: !!mentionMatch,
    query: mentionMatch?.[1] ?? "",
    startIndex: mentionMatch ? textBeforeCursor.length - mentionMatch[0].length : -1,
  };
}
