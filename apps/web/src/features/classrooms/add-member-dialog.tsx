import { useState } from "react";
import { X } from "lucide-react";
import { USER_ROLES } from "@teaching/shared";

interface AddMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: string) => Promise<void>;
}

export function AddMemberDialog({ open, onClose, onSubmit }: AddMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("student");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit(email, role);
      setEmail("");
      setRole("student");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm rounded-2xl border p-6 space-y-4 shadow-xl"
        style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}>
            Add Member
          </h3>
          <button type="button" onClick={onClose} style={{ color: "var(--color-muted-foreground)" }}>
            <X size={18} />
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@example.com"
            className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:border-[var(--color-primary)]"
            style={{ borderColor: "var(--color-border)", background: "var(--color-background)", color: "var(--color-foreground)" }}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Role</span>
          <div className="flex gap-2">
            {USER_ROLES.filter((r) => r !== "teacher").map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className="px-3 py-1.5 rounded-lg border text-sm capitalize transition-colors"
                style={{
                  borderColor: role === r ? "var(--color-primary)" : "var(--color-border)",
                  background: role === r ? "var(--color-primary)" : "var(--color-card)",
                  color: role === r ? "#fff" : "var(--color-foreground)",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </label>

        {error && <p className="text-sm" style={{ color: "var(--color-destructive)" }}>{error}</p>}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--color-primary)", color: "#fff" }}
        >
          {loading ? "Adding…" : "Add Member"}
        </button>
      </form>
    </div>
  );
}
