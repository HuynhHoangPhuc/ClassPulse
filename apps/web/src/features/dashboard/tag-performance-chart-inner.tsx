import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts"

interface TagPerf {
  tagId: string
  name: string
  color: string | null
  accuracy: number
  totalAnswers: number
}

export default function TagPerformanceChartInner({ data }: { data: TagPerf[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(150, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
          tickFormatter={(v: number) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
          width={100}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, _name, props) =>
            [`${Math.round(Number(value))}% (${(props as any).payload.totalAnswers} answers)`, "Accuracy"]
          }
        />
        <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} barSize={24}>
          {data.map((entry) => (
            <Cell key={entry.tagId} fill={entry.color || "#8B5CF6"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
