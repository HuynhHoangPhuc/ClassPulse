import { useState } from "react"
import { ChevronDown, ChevronRight, Clock } from "lucide-react"
import { Card } from "@/components/ui/card"

interface HistoryItem {
  attemptId: string
  assessmentTitle: string
  classroomName: string
  startedAt: number
  submittedAt: number | null
  score: number | null
  totalPossible: number | null
  timeTaken: number | null
  parentDetailView: string
}

interface AssessmentHistoryTableProps {
  items: HistoryItem[]
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`
}

export function AssessmentHistoryTable({
  items,
  isLoading,
  hasMore,
  onLoadMore,
}: AssessmentHistoryTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
      <p
        className="text-sm font-semibold mb-3"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
      >
        Assessment History
      </p>

      {isLoading && items.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "var(--color-muted)" }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: "var(--color-muted-foreground)" }}>
          No assessments taken yet
        </p>
      ) : (
        <>
          {/* Header */}
          <div
            className="hidden sm:grid grid-cols-5 gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            <span className="col-span-2">Assessment</span>
            <span>Classroom</span>
            <span>Score</span>
            <span>Time</span>
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {items.map((item) => {
              const scorePercent =
                item.score != null && item.totalPossible
                  ? Math.round((item.score / item.totalPossible) * 100)
                  : null
              const isExpanded = expandedId === item.attemptId
              const canExpand = item.parentDetailView === "full_detail"

              return (
                <div key={item.attemptId}>
                  <button
                    onClick={() => canExpand && setExpandedId(isExpanded ? null : item.attemptId)}
                    className="w-full grid grid-cols-1 sm:grid-cols-5 gap-1 sm:gap-2 px-3 py-3 text-left text-sm hover:bg-[var(--color-muted)] transition-colors rounded-lg"
                    disabled={!canExpand}
                  >
                    <span className="col-span-2 flex items-center gap-2 font-medium truncate" style={{ color: "var(--color-foreground)" }}>
                      {canExpand && (
                        isExpanded
                          ? <ChevronDown size={14} className="shrink-0" />
                          : <ChevronRight size={14} className="shrink-0" />
                      )}
                      {item.assessmentTitle}
                    </span>
                    <span className="truncate" style={{ color: "var(--color-muted-foreground)" }}>
                      {item.classroomName}
                    </span>
                    <span
                      className="font-medium"
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        color: scorePercent != null && scorePercent >= 80
                          ? "var(--color-success)"
                          : scorePercent != null && scorePercent >= 50
                            ? "var(--color-warning)"
                            : "var(--color-destructive)",
                      }}
                    >
                      {scorePercent != null ? `${scorePercent}%` : "—"}
                      <span className="text-xs ml-1" style={{ color: "var(--color-muted-foreground)" }}>
                        ({item.score ?? 0}/{item.totalPossible ?? 0})
                      </span>
                    </span>
                    <span className="flex items-center gap-1" style={{ color: "var(--color-muted-foreground)" }}>
                      <Clock size={12} />
                      {item.timeTaken ? formatDuration(item.timeTaken) : "—"}
                    </span>
                  </button>

                  {/* Expanded detail placeholder — full_detail shows per-question breakdown */}
                  {isExpanded && canExpand && (
                    <div
                      className="px-6 py-3 text-xs"
                      style={{ color: "var(--color-muted-foreground)", background: "var(--color-muted)" }}
                    >
                      <p>Detailed per-question breakdown available from assessment results page.</p>
                      <p className="mt-1">
                        Submitted: {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "—"}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {hasMore && (
            <button
              onClick={onLoadMore}
              disabled={isLoading}
              className="w-full py-2 mt-2 text-sm font-medium rounded-lg hover:bg-[var(--color-muted)] transition-colors"
              style={{ color: "var(--color-primary)" }}
            >
              {isLoading ? "Loading..." : "Load more"}
            </button>
          )}
        </>
      )}
    </Card>
  )
}
