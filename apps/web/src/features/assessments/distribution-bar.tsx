/** Visual percentage bar showing tag/complexity distribution */
interface Segment {
  label: string;
  percent: number;
  color: string;
}

interface DistributionBarProps {
  segments: Segment[];
  height?: number;
}

export function DistributionBar({ segments, height = 8 }: DistributionBarProps) {
  return (
    <div className="space-y-1">
      <div
        className="w-full flex rounded-full overflow-hidden"
        style={{ height, background: "var(--color-muted)" }}
      >
        {segments.map((seg) => (
          <div
            key={seg.label}
            title={`${seg.label}: ${seg.percent}%`}
            style={{ width: `${seg.percent}%`, background: seg.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1 text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: seg.color }} />
            {seg.label} {seg.percent}%
          </span>
        ))}
      </div>
    </div>
  );
}
