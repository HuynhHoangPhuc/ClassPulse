import { useRef, useState } from "react";
import { Bold, Italic, Code, Link, Image, Sigma, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownPreview } from "./markdown-preview";

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
  placeholder?: string;
}

type Tab = "edit" | "preview";

/**
 * Markdown textarea with toolbar helpers and live preview.
 * Desktop: side-by-side edit + preview panels.
 * Mobile: tabbed Edit / Preview.
 */
export function MarkdownEditor({
  value,
  onChange,
  onImageUpload,
  placeholder = "Write in Markdown…",
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("edit");
  const [uploading, setUploading] = useState(false);

  // Insert or wrap selected text with prefix/suffix
  function wrapSelection(prefix: string, suffix = prefix) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "text";
    const next =
      value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length
      );
    });
  }

  function insertAtCursor(snippet: string) {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const next = value.slice(0, pos) + snippet + value.slice(pos);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos + snippet.length, pos + snippet.length);
    });
  }

  async function handleImageFile(file: File) {
    if (!onImageUpload) return;
    setUploading(true);
    try {
      const url = await onImageUpload(file);
      insertAtCursor(`![${file.name}](${url})`);
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  const toolbar = (
    <div
      className="flex items-center gap-1 px-2 py-1.5 border-b flex-wrap"
      style={{ borderColor: "var(--color-border)", background: "var(--color-muted)" }}
    >
      {[
        { icon: <Bold size={14} />, title: "Bold", action: () => wrapSelection("**") },
        { icon: <Italic size={14} />, title: "Italic", action: () => wrapSelection("*") },
        { icon: <Code size={14} />, title: "Inline code", action: () => wrapSelection("`") },
        { icon: <AlignLeft size={14} />, title: "Code block", action: () => wrapSelection("```\n", "\n```") },
        { icon: <Link size={14} />, title: "Link", action: () => wrapSelection("[", "](url)") },
        { icon: <Sigma size={14} />, title: "Math", action: () => wrapSelection("$") },
      ].map(({ icon, title, action }) => (
        <button
          key={title}
          type="button"
          title={title}
          onClick={action}
          className="p-1.5 rounded hover:opacity-80 transition-opacity"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          {icon}
        </button>
      ))}

      {onImageUpload && (
        <>
          <button
            type="button"
            title="Insert image"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            <Image size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
  );

  const editArea = (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full flex-1 resize-none p-3 text-sm outline-none bg-transparent"
      style={{
        color: "var(--color-foreground)",
        fontFamily: "var(--font-code, monospace)",
        minHeight: 160,
      }}
    />
  );

  return (
    <div
      className="rounded-[var(--radius-card)] border overflow-hidden"
      style={{ borderColor: "var(--color-border)" }}
    >
      {toolbar}

      {/* Mobile: tabs */}
      <div className="md:hidden">
        <div
          className="flex border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          {(["edit", "preview"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2 text-xs font-medium capitalize transition-colors",
                tab === t
                  ? "border-b-2"
                  : "opacity-60"
              )}
              style={
                tab === t
                  ? { borderColor: "var(--color-primary)", color: "var(--color-primary)" }
                  : { color: "var(--color-muted-foreground)" }
              }
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "edit" ? editArea : <div className="p-3"><MarkdownPreview content={value} /></div>}
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden md:flex" style={{ minHeight: 180 }}>
        <div className="flex-1 flex flex-col border-r" style={{ borderColor: "var(--color-border)" }}>
          {editArea}
        </div>
        <div className="flex-1 overflow-auto p-3">
          <MarkdownPreview content={value} />
        </div>
      </div>
    </div>
  );
}
