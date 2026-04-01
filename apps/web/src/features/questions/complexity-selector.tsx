import {
  COMPLEXITY_LEVELS,
  COMPLEXITY_LABELS,
  COMPLEXITY_COLORS,
} from "@teaching/shared";
import type { ComplexityLevel } from "@teaching/shared";
import { cn } from "@/lib/utils";

interface ComplexitySelectorProps {
  value: number;
  onChange: (v: number) => void;
}

/**
 * Visual 1–5 scale rendered as colored circles.
 * Active circle is filled; inactive circles are outlined.
 */
export function ComplexitySelector({ value, onChange }: ComplexitySelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {COMPLEXITY_LEVELS.map((level) => {
          const color = COMPLEXITY_COLORS[level];
          const active = value === level;
          return (
            <button
              key={level}
              type="button"
              title={COMPLEXITY_LABELS[level]}
              onClick={() => onChange(level)}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2",
                "hover:scale-110 active:scale-95"
              )}
              style={{
                borderColor: color,
                background: active ? color : "transparent",
                boxShadow: active ? `0 0 0 3px ${color}33` : undefined,
              }}
              aria-pressed={active}
              aria-label={`Complexity ${level}: ${COMPLEXITY_LABELS[level]}`}
            />
          );
        })}
      </div>

      {/* Label for active value */}
      <p
        className="text-xs font-medium"
        style={{
          color: COMPLEXITY_COLORS[value as ComplexityLevel] ?? "var(--color-muted-foreground)",
        }}
      >
        Level {value} — {COMPLEXITY_LABELS[value as ComplexityLevel]}
      </p>
    </div>
  );
}
