import { useState, useRef } from "react";
import { Send } from "lucide-react";
import { MentionAutocomplete, useMentionDetection } from "./mention-autocomplete";

interface CommentInputProps {
  classroomId: string;
  placeholder?: string;
  onSubmit: (content: string, mentionUserIds: string[]) => Promise<void>;
}

export function CommentInput({ classroomId, placeholder = "Write a comment…", onSubmit }: CommentInputProps) {
  const [value, setValue] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionIdsRef = useRef<Set<string>>(new Set());

  const mention = useMentionDetection(value, cursorPos);

  function handleSelect(member: { userId: string; name: string }) {
    // Replace @query with @[Name](userId)
    const before = value.slice(0, mention.startIndex);
    const after = value.slice(cursorPos);
    const insertion = `@[${member.name}](${member.userId}) `;
    const newValue = before + insertion + after;
    setValue(newValue);
    mentionIdsRef.current.add(member.userId);

    // Restore focus and cursor
    const newPos = before.length + insertion.length;
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(newPos, newPos);
      setCursorPos(newPos);
    }, 0);
  }

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      // Re-extract mention IDs from final content to avoid phantom mentions
      const mentionRegex = /@\[[^\]]*\]\(([^)]+)\)/g;
      const finalIds: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = mentionRegex.exec(trimmed)) !== null) finalIds.push(m[1]);
      await onSubmit(trimmed, [...new Set(finalIds)]);
      setValue("");
      mentionIdsRef.current.clear();
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="relative">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setCursorPos(e.target.selectionStart);
          }}
          onSelect={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 px-3 py-2 rounded-xl border text-sm outline-none resize-none focus:border-[var(--color-primary)]"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-background)",
            color: "var(--color-foreground)",
          }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !value.trim()}
          className="p-2 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-30"
          style={{ background: "var(--color-primary)", color: "#fff" }}
        >
          <Send size={14} />
        </button>
      </div>
      <MentionAutocomplete
        classroomId={classroomId}
        query={mention.query}
        visible={mention.active}
        onSelect={handleSelect}
        onClose={() => setCursorPos(0)}
      />
    </div>
  );
}
