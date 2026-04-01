import { Menu, Bell } from "lucide-react";
import { UserButton } from "@clerk/clerk-react";
import { DarkModeToggle } from "./dark-mode-toggle";
import { cn } from "@/lib/utils";

interface HeaderProps {
  /** Page title displayed in the center-left area */
  title?: string;
  /** Called when the mobile sidebar toggle is clicked */
  onMenuClick?: () => void;
  className?: string;
}

export function Header({ title, onMenuClick, className }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between px-4 md:px-6 shrink-0",
        "border-b border-[var(--color-border)]",
        "bg-[var(--color-card)]",
        className
      )}
      style={{ height: "var(--header-height)" }}
    >
      {/* Left: mobile menu toggle + page title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
          className={cn(
            "md:hidden flex items-center justify-center w-9 h-9 rounded-xl",
            "hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
            "transition-colors"
          )}
        >
          <Menu size={20} />
        </button>
        {title && (
          <span
            className="text-base font-semibold truncate"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--color-foreground)",
            }}
          >
            {title}
          </span>
        )}
      </div>

      {/* Right: dark mode toggle + notifications + user */}
      <div className="flex items-center gap-1">
        <DarkModeToggle />
        <button
          aria-label="Notifications"
          className={cn(
            "relative flex items-center justify-center w-9 h-9 rounded-xl",
            "hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
            "transition-colors"
          )}
        >
          <Bell size={18} />
        </button>
        <div className="ml-2">
          <UserButton afterSignOutUrl="/login" />
        </div>
      </div>
    </header>
  );
}
