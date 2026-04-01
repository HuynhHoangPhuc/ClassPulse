import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "success" | "warning";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20",
  secondary:
    "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border-[var(--color-secondary)]/20",
  destructive:
    "bg-[var(--color-destructive)]/10 text-[var(--color-destructive)] border-[var(--color-destructive)]/20",
  success:
    "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20",
  warning:
    "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20",
};

export function Badge({ variant = "default", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-xs font-medium",
        "rounded-[var(--radius-badge)] border",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
