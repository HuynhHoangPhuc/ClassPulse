import { Card } from "@/components/ui/card"

interface ScoreGaugeCardProps {
  score: number // 0-100
  label: string
}

/** Circular gauge showing avg score. Green >80%, amber 50-80%, red <50% */
export function ScoreGaugeCard({ score, label }: ScoreGaugeCardProps) {
  const rounded = Math.round(score)
  const clampedScore = Math.min(100, Math.max(0, rounded))

  // SVG gauge: 180-degree arc
  const radius = 60
  const strokeWidth = 10
  const cx = 70
  const cy = 70
  // Arc from 180° to 0° (left to right, bottom half)
  const circumference = Math.PI * radius
  const progress = (clampedScore / 100) * circumference
  const dashOffset = circumference - progress

  const color =
    clampedScore >= 80
      ? "var(--color-success)"
      : clampedScore >= 50
        ? "var(--color-warning)"
        : "var(--color-destructive)"

  return (
    <Card className="flex flex-col items-center justify-center py-6">
      <svg width={140} height={80} viewBox="0 0 140 80">
        {/* Background arc */}
        <path
          d="M 10 70 A 60 60 0 0 1 130 70"
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d="M 10 70 A 60 60 0 0 1 130 70"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <p
        className="text-3xl font-bold -mt-4"
        style={{ fontFamily: "var(--font-heading)", color, fontVariantNumeric: "tabular-nums" }}
      >
        {clampedScore}%
      </p>
      <p
        className="text-xs font-medium mt-1 uppercase tracking-wider"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        {label}
      </p>
    </Card>
  )
}
