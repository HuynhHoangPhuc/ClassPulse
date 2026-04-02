import { CheckCircle } from "lucide-react"
import { Card } from "@/components/ui/card"

interface ActivityItem {
  type: "assessment_completed"
  id: string
  timestamp: number
  description: string
  score: number | null
  totalPossible: number | null
}

interface ActivityFeedProps {
  items: ActivityItem[]
  isLoading: boolean
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

export function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  return (
    <Card>
      <p
        className="text-sm font-semibold mb-3"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
      >
        Recent Activity
      </p>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "var(--color-muted)" }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: "var(--color-muted-foreground)" }}>
          No activity yet
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const scorePercent =
              item.score != null && item.totalPossible
                ? Math.round((item.score / item.totalPossible) * 100)
                : null

            return (
              <li
                key={item.id}
                className="flex items-start gap-3 py-2 border-b last:border-b-0"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div
                  className="shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "color-mix(in srgb, var(--color-success) 15%, transparent)" }}
                >
                  <CheckCircle size={14} style={{ color: "var(--color-success)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: "var(--color-foreground)" }}>
                    Completed <span className="font-medium">{item.description}</span>
                    {scorePercent != null && (
                      <span style={{ color: "var(--color-muted-foreground)" }}> — {scorePercent}%</span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    {relativeTime(item.timestamp)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
