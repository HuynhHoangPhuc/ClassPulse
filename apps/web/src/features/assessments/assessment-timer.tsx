import { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssessmentTimerProps {
  timeRemainingSeconds: number | null;
  serverTime: number;
  onTimeUp: () => void;
}

/** Countdown timer with visual states per design guidelines */
export function AssessmentTimer({ timeRemainingSeconds, serverTime, onTimeUp }: AssessmentTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(timeRemainingSeconds);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;
  const firedRef = useRef(false);

  useEffect(() => {
    if (timeRemainingSeconds === null) return;

    // Calculate local deadline accounting for network latency
    const receivedAt = Date.now();
    const deadline = receivedAt + timeRemainingSeconds * 1000;

    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onTimeUpRef.current();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timeRemainingSeconds, serverTime]);

  if (remaining === null) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isWarning = remaining <= 300 && remaining > 60;
  const isCritical = remaining <= 60;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 font-mono text-sm font-medium tabular-nums",
        isCritical && "animate-pulse",
        isWarning && "animate-[pulse_2s_ease-in-out_infinite]",
      )}
      style={{
        color: isCritical
          ? "var(--color-destructive)"
          : isWarning
            ? "var(--color-warning)"
            : "var(--color-foreground)",
      }}
    >
      <Clock size={16} />
      <span>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
}
