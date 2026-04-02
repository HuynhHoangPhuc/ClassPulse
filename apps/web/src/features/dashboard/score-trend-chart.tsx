import { lazy, Suspense } from "react"
import { Card } from "@/components/ui/card"

const LazyChart = lazy(() => import("./score-trend-chart-inner"))

interface TrendPoint {
  date: string
  avg: number
}

interface ScoreTrendChartProps {
  data: TrendPoint[]
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  return (
    <Card className="col-span-1 sm:col-span-2">
      <p
        className="text-sm font-semibold mb-4"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
      >
        Score Trend (30 days)
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
