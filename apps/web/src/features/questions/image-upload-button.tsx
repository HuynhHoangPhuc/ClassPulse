import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { fetchApi } from "@/lib/fetch-api";

interface ImageUploadButtonProps {
  onUpload: (url: string) => void;
  token: string | null;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Hidden file input wired to a visible button.
 * Validates size client-side, POSTs as multipart FormData,
 * and calls onUpload with the returned URL.
 */
export function ImageUploadButton({ onUpload, token }: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setError("File exceeds 5 MB limit.");
      e.target.value = "";
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);

      const data = await fetchApi(
        "/api/upload/image",
        { method: "POST", body: form },
        token
      ) as { url: string };

      onUpload(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--radius-badge)] border transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{
          borderColor: "var(--color-border)",
          color: "var(--color-foreground)",
          background: "var(--color-card)",
        }}
      >
        {uploading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <ImagePlus size={13} />
        )}
        {uploading ? "Uploading…" : "Upload image"}
      </button>

      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
