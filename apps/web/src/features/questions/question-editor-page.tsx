import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { fetchApi } from "@/lib/fetch-api";
import { COMPLEXITY_TYPES } from "@teaching/shared";
import type { Question, QuestionOption } from "@teaching/shared";
import { MarkdownEditor } from "./markdown-editor";
import { MarkdownPreview } from "./markdown-preview";
import { TagSelector } from "./tag-selector";
import { ComplexitySelector } from "./complexity-selector";
import { ImageUploadButton } from "./image-upload-button";

interface QuestionEditorPageProps {
  questionId?: string;
}

interface OptionDraft {
  id: string;
  text: string;
  isCorrect: boolean;
}

function makeOption(): OptionDraft {
  return { id: crypto.randomUUID(), text: "", isCorrect: false };
}

function defaultOptions(): OptionDraft[] {
  return [
    { ...makeOption(), isCorrect: true },
    makeOption(),
    makeOption(),
    makeOption(),
  ];
}

export function QuestionEditorPage({ questionId }: QuestionEditorPageProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const isEdit = Boolean(questionId);

  const [content, setContent] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>(defaultOptions());
  const [complexity, setComplexity] = useState(1);
  const [complexityType, setComplexityType] = useState<string>(COMPLEXITY_TYPES[0]);
  const [explanation, setExplanation] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch token once
  useEffect(() => {
    getToken().then(setToken).catch(console.error);
  }, [getToken]);

  // Load existing question for edit mode
  useEffect(() => {
    if (!questionId || !token) return;
    fetchApi(`/api/questions/${questionId}`, {}, token)
      .then((raw) => {
        const q = raw as Question & { tags: { id: string }[] };
        setContent(q.content);
        setOptions(
          (q.options as QuestionOption[]).map((o) => ({
            id: o.id,
            text: o.text,
            isCorrect: o.isCorrect,
          }))
        );
        setComplexity(q.complexity);
        setComplexityType(q.complexityType);
        setExplanation(q.explanation ?? "");
        setShowExplanation(Boolean(q.explanation));
        setTagIds(q.tags.map((t) => t.id));
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load question."));
  }, [questionId, token]);

  // ── Options helpers ──────────────────────────────────────────────────────────

  function updateOptionText(id: string, text: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
  }

  function setCorrect(id: string) {
    setOptions((prev) => prev.map((o) => ({ ...o, isCorrect: o.id === id })));
  }

  function removeOption(id: string) {
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }

  function addOption() {
    setOptions((prev) => [...prev, makeOption()]);
  }

  // ── Image upload helper forwarded to MarkdownEditor ──────────────────────────

  async function handleImageUpload(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const data = await fetchApi("/api/upload/image", { method: "POST", body: form }, token) as { url: string };
    return data.url;
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!content.trim()) { setSaveError("Question content is required."); return; }
    if (options.length < 2) { setSaveError("At least 2 options are required."); return; }
    if (!options.some((o) => o.isCorrect)) { setSaveError("Mark at least one correct answer."); return; }
    if (options.some((o) => !o.text.trim())) { setSaveError("All options must have text."); return; }

    setSaveError(null);
    setSaving(true);

    try {
      const t = token ?? await getToken();
      const body = {
        content,
        options: options.map(({ id, text, isCorrect }) => ({ id, text, isCorrect })),
        complexity,
        complexityType,
        explanation: explanation.trim() || null,
        tagIds,
      };

      if (isEdit) {
        await fetchApi(`/api/questions/${questionId}`, { method: "PUT", body: JSON.stringify(body) }, t);
      } else {
        await fetchApi("/api/questions", { method: "POST", body: JSON.stringify(body) }, t);
      }

      navigate({ to: "/questions" });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <PageHeader title={isEdit ? "Edit Question" : "New Question"} />
        <p className="text-sm" style={{ color: "var(--color-destructive)" }}>{loadError}</p>
      </div>
    );
  }

  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => navigate({ to: "/questions" })}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-[var(--radius-card)] border transition-opacity hover:opacity-80"
        style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)", background: "var(--color-card)" }}
      >
        <ArrowLeft size={14} />
        Back
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-[var(--radius-card)] transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--color-primary)", color: "#fff" }}
      >
        {saving ? "Saving…" : isEdit ? "Save changes" : "Create question"}
      </button>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? "Edit Question" : "New Question"}
        description={isEdit ? "Update question content, options, and metadata." : "Create a new question for your bank."}
        actions={headerActions}
      />

      {saveError && (
        <p className="text-sm px-3 py-2 rounded-[var(--radius-card)] border" style={{ borderColor: "var(--color-destructive)", color: "var(--color-destructive)", background: "var(--color-destructive)/10" }}>
          {saveError}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Form ── */}
        <div className="space-y-6">

          {/* Content editor */}
          <section className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
              Question content <span style={{ color: "var(--color-destructive)" }}>*</span>
            </label>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              onImageUpload={handleImageUpload}
              placeholder="Write your question in Markdown…"
            />
            <ImageUploadButton onUpload={(url) => setContent((c) => c + `\n\n![image](${url})`)} token={token} />
          </section>

          {/* Options */}
          <section className="space-y-3">
            <label className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
              Answer options <span style={{ color: "var(--color-muted-foreground)" }}>(select correct)</span>
            </label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-option"
                    checked={opt.isCorrect}
                    onChange={() => setCorrect(opt.id)}
                    className="shrink-0 accent-[var(--color-primary)]"
                    title="Mark as correct"
                  />
                  <input
                    value={opt.text}
                    onChange={(e) => updateOptionText(opt.id, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 text-sm px-3 py-2 rounded-[var(--radius-badge)] border bg-transparent outline-none focus:border-[var(--color-primary)] transition-colors"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(opt.id)}
                      className="p-1.5 rounded transition-opacity hover:opacity-70 shrink-0"
                      style={{ color: "var(--color-muted-foreground)" }}
                      title="Remove option"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 6 && (
              <button
                type="button"
                onClick={addOption}
                className="inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
                style={{ color: "var(--color-primary)" }}
              >
                <Plus size={12} />
                Add option
              </button>
            )}
          </section>

          {/* Tags */}
          <section className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
              Tags
            </label>
            <TagSelector selectedTagIds={tagIds} onChange={setTagIds} token={token} />
          </section>

          {/* Complexity */}
          <section className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
              Complexity
            </label>
            <ComplexitySelector value={complexity} onChange={setComplexity} />
          </section>

          {/* Complexity type */}
          <section className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
              Complexity type
            </label>
            <select
              value={complexityType}
              onChange={(e) => setComplexityType(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-[var(--radius-card)] border bg-transparent capitalize outline-none"
              style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)", background: "var(--color-card)" }}
            >
              {COMPLEXITY_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize" style={{ background: "var(--color-card)" }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </section>

          {/* Explanation (collapsible) */}
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => setShowExplanation((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--color-foreground)" }}
            >
              Explanation (optional)
              {showExplanation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showExplanation && (
              <MarkdownEditor
                value={explanation}
                onChange={setExplanation}
                placeholder="Explain the correct answer…"
              />
            )}
          </section>
        </div>

        {/* ── Right: Preview ── */}
        <div
          className="hidden lg:block rounded-[var(--radius-card)] border p-5 space-y-4 self-start sticky top-6"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-muted-foreground)" }}>
            Preview
          </p>
          <MarkdownPreview content={content || "_Your question will appear here…_"} />

          {options.some((o) => o.text) && (
            <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
              <p className="text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>Options</p>
              {options.filter((o) => o.text).map((opt) => (
                <div
                  key={opt.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-[var(--radius-badge)] text-sm border",
                    opt.isCorrect && "border-[var(--color-success)]"
                  )}
                  style={{
                    borderColor: opt.isCorrect ? "var(--color-success)" : "var(--color-border)",
                    background: opt.isCorrect ? "var(--color-success)/10" : "transparent",
                    color: "var(--color-foreground)",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: opt.isCorrect ? "var(--color-success)" : "var(--color-muted)" }}
                  />
                  {opt.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
