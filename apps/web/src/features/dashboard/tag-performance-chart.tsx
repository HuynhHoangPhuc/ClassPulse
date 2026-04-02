import { lazy, Suspense } from "react"
import { Card } from "@/components/ui/card"

const LazyChart = lazy(() => import("./tag-performance-chart-inner"))

interface TagPerf {
  tagId: string
  name: string
  color: string | null
  accuracy: number
  totalAnswers: number
}

interface TagPerformanceChartProps {
  data: TagPerf[]
}

export function TagPerformanceChart({ data }: TagPerformanceChartProps) {
  return (
    <Card className="col-span-1 sm:col-span-2">
      <p
        className="text-sm font-semibold mb-4"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
      >
        Performance by Topic
      </p>
      {data.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--color-muted-foreground)" }}>
          No data yet
        </p>
      ) : (
        <Suspense
          fallback={
            <div className="h-48 rounded-lg animate-pulse" style={{ background: "var(--color-muted)" }} />
          }
        >
          <LazyChart data={data} />
        </Suspense>
      )}
    </Card>
  )
}
