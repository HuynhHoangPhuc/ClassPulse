import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional action buttons rendered on the right */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1
          className="text-2xl font-bold truncate"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--color-foreground)",
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
