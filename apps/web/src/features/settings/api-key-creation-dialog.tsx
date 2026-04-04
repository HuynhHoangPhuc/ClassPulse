import { useState } from "react"
import { useAuth } from "@clerk/clerk-react"
import { useQueryClient } from "@tanstack/react-query"
import { fetchApi } from "@/lib/fetch-api"
import { Copy, Check, AlertTriangle, X } from "lucide-react"

interface ApiKeyCreationDialogProps {
  open: boolean
  onClose: () => void
}

const EXPIRATION_OPTIONS = [
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "180 days", value: 180 },
  { label: "365 days", value: 365 },
  { label: "Never", value: 0 },
]

interface CreatedKey {
  id: string
  name: string
  secret: string
  scopes: string[]
  createdAt: number
}

export function ApiKeyCreationDialog({ open, onClose }: ApiKeyCreationDialogProps) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [expiresInDays, setExpiresInDays] = useState(90)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null)
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Name is required")
      return
    }

    setLoading(true)
    setError("")

    try {
      const token = await getToken()
      const result = await fetchApi(
        "/api/users/api-keys",
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            ...(expiresInDays > 0 ? { expiresInDays } : {}),
          }),
        },
        token,
        getToken,
      ) as CreatedKey
      setCreatedKey(result)
      queryClient.invalidateQueries({ queryKey: ["api-keys"] })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey.secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setName("")
    setExpiresInDays(90)
    setError("")
    setCreatedKey(null)
    setCopied(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md rounded-lg border p-6"
        style={{
          backgroundColor: "var(--color-card)",
          borderColor: "var(--color-border)",
        }}
      >
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 rounded p-1 hover:opacity-70"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          <X size={16} />
        </button>

        <h3
          className="text-base font-semibold mb-4"
          style={{ color: "var(--color-foreground)" }}
        >
          {createdKey ? "API Key Created" : "Create API Key"}
        </h3>

        {createdKey ? (
          /* ── Secret display (shown once) ── */
          <div className="space-y-4">
            <div
              className="flex items-start gap-2 rounded-md p-3 text-sm"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-warning) 15%, transparent)",
                color: "var(--color-warning)",
              }}
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>Copy this key now. It won't be shown again.</span>
            </div>

            <div>
              <label className="text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>
                API Key
              </label>
              <div
                className="mt-1 flex items-center gap-2 rounded-md border p-3"
                style={{
                  backgroundColor: "var(--color-muted)",
                  borderColor: "var(--color-border)",
                }}
              >
                <code
                  className="flex-1 break-all text-xs"
                  style={{ color: "var(--color-foreground)" }}
                >
                  {createdKey.secret}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded p-1 hover:opacity-70"
                  style={{ color: "var(--color-primary)" }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full rounded-md px-4 py-2 text-sm font-medium"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
              }}
            >
              I've copied the key
            </button>
          </div>
        ) : (
          /* ── Create form ── */
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>
                Key Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ChatGPT Integration"
                maxLength={100}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: "var(--color-muted)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              />
            </div>

            <div>
              <label className="text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>
                Expiration
              </label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: "var(--color-muted)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              >
                {EXPIRATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{error}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleClose}
                className="rounded-md px-4 py-2 text-sm"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-primary-foreground)",
                }}
              >
                {loading ? "Creating..." : "Create Key"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
