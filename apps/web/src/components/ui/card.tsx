import { cn } from "@/lib/utils";

type CardVariant = "standard" | "glass" | "accent";

interface CardProps {
  variant?: CardVariant;
  className?: string;
  children: React.ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  standard: [
    "bg-[var(--color-card)]",
    "border border-[var(--color-border)]",
    "shadow-sm",
  ].join(" "),
  glass: [
    "bg-white/10 dark:bg-white/5",
    "backdrop-blur-md",
    "border border-white/20",
    "shadow-lg",
  ].join(" "),
  accent: [
    "bg-[var(--color-primary)]/10",
    "border border-[var(--color-primary)]/20",
  ].join(" "),
};

export function Card({ variant = "standard", className, children }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] p-5",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
