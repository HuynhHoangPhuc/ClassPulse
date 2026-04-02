import { Users, BookOpen } from "lucide-react"
import { Card } from "@/components/ui/card"

interface ClassroomOverview {
  classroomId: string
  classroomName: string
  teacherName: string
  totalAssessments: number
  completedAssessments: number
  completionRate: number
}

interface ClassroomOverviewCardProps {
  classrooms: ClassroomOverview[]
  isLoading: boolean
}

export function ClassroomOverviewCards({ classrooms, isLoading }: ClassroomOverviewCardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "var(--color-muted)" }} />
        ))}
      </div>
    )
  }

  if (classrooms.length === 0) {
    return (
      <Card>
        <p className="text-sm py-4 text-center" style={{ color: "var(--color-muted-foreground)" }}>
          Not enrolled in any classrooms
        </p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {classrooms.map((c) => (
        <Card key={c.classroomId} variant="standard">
          <div className="flex items-start justify-between mb-2">
            <p
              className="text-sm font-semibold truncate"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
            >
              {c.classroomName}
            </p>
            <span
              className="shrink-0 ml-2 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                fontVariantNumeric: "tabular-nums",
                background: c.completionRate >= 80
                  ? "color-mix(in srgb, var(--color-success) 15%, transparent)"
                  : "color-mix(in srgb, var(--color-warning) 15%, transparent)",
                color: c.completionRate >= 80 ? "var(--color-success)" : "var(--color-warning)",
              }}
            >
              {c.completionRate}%
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
            <span className="flex items-center gap-1">
              <Users size={12} />
              {c.teacherName}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen size={12} />
              {c.completedAssessments}/{c.totalAssessments} completed
            </span>
          </div>
          {/* Completion bar */}
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-muted)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${c.completionRate}%`,
                background: c.completionRate >= 80 ? "var(--color-success)" : "var(--color-warning)",
              }}
            />
          </div>
        </Card>
      ))}
    </div>
  )
}
