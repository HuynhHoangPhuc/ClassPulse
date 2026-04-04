import { useState } from "react"
import { useAuth } from "@clerk/clerk-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchApi } from "@/lib/fetch-api"
import { Card } from "@/components/ui/card"
import { Key, Plus, Trash2 } from "lucide-react"
import { ApiKeyCreationDialog } from "./api-key-creation-dialog"

interface ApiKeyItem {
  id: string
  name: string
  scopes: string[]
  revoked: boolean
  expiration: number | null
  createdAt: number
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function getKeyStatus(key: ApiKeyItem): { label: string; color: string } {
  if (key.revoked) return { label: "Revoked", color: "var(--color-destructive)" }
  if (key.expiration && key.expiration < Date.now())
    return { label: "Expired", color: "var(--color-warning)" }
  return { label: "Active", color: "var(--color-success)" }
}

export function ApiKeyManagementCard() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const { data: keys, isLoading } = useQuery<ApiKeyItem[]>({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const token = await getToken()
      return fetchApi("/api/users/api-keys", {}, token) as Promise<ApiKeyItem[]>
    },
    staleTime: 1000 * 60 * 2,
  })

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this API key? This action cannot be undone.")) return

    setRevoking(id)
    try {
      const token = await getToken()
      await fetchApi(`/api/users/api-keys/${id}`, { method: "DELETE" }, token, getToken)
      queryClient.invalidateQueries({ queryKey: ["api-keys"] })
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke key")
    } finally {
      setRevoking(null)
    }
  }

  // Filter out revoked keys for cleaner display
  const activeKeys = keys?.filter((k) => !k.revoked) ?? []
  const hasKeys = activeKeys.length > 0

  return (
    <>
      <Card variant="standard">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Key size={18} style={{ color: "var(--color-primary)" }} />
            <h2
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-foreground)" }}
            >
              API Keys
            </h2>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-primary-foreground)",
            }}
          >
            <Plus size={14} />
            Create Key
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            Loading...
          </p>
        ) : !hasKeys ? (
          <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            No API keys yet. Create one to allow AI tools to access your account.
          </p>
        ) : (
          <div className="space-y-2">
            {activeKeys.map((key) => {
              const status = getKeyStatus(key)
              return (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--color-foreground)" }}
                      >
                        {key.name}
                      </span>
                      <span
                        className="text-xs font-medium px-1.5 py-0.5 rounded"
                        style={{
                          color: status.color,
                          backgroundColor: `color-mix(in srgb, ${status.color} 15%, transparent)`,
                        }}
                      >
                        {status.label}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                      Created {formatDate(key.createdAt)}
                      {key.expiration
                        ? ` · Expires ${formatDate(key.expiration)}`
                        : " · Never expires"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRevoke(key.id)}
                    disabled={revoking === key.id}
                    className="ml-2 shrink-0 rounded p-1.5 hover:opacity-70 disabled:opacity-50"
                    style={{ color: "var(--color-destructive)" }}
                    title="Revoke key"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <ApiKeyCreationDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}
