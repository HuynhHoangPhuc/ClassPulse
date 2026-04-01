import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  headline: string;
  description?: string;
  /** Optional CTA button(s) */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  headline,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "rounded-[var(--radius-card)] border border-dashed",
        "border-[var(--color-border)] p-12 gap-4",
        className
      )}
    >
      {icon && (
        <div
          className="flex items-center justify-center w-16 h-16 rounded-2xl"
          style={{
            background: "var(--color-muted)",
            color: "var(--color-muted-foreground)",
          }}
        >
          {icon}
        </div>
      )}
      <div className="space-y-1 max-w-sm">
        <h3
          className="text-base font-semibold"
          style={{ color: "var(--color-foreground)" }}
        >
          {headline}
        </h3>
        {description && (
          <p
            className="text-sm"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
