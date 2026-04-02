/** Renders @[Name](user_id) patterns as styled mention chips in comment text */
export function MentionRenderer({ content }: { content: string }) {
  // Split content into text and mention parts
  const parts: { type: "text" | "mention"; value: string; userId?: string }[] = [];
  const regex = /@\[([^\]]*)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "mention", value: match[1], userId: match[2] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.type === "mention" ? (
          <span
            key={i}
            className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium"
            style={{ background: "color-mix(in srgb, var(--color-primary) 15%, transparent)", color: "var(--color-primary)" }}
          >
            @{part.value}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </span>
  );
}
