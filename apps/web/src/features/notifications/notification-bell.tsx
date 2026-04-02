import { useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "./notification-provider";
import { NotificationPanel } from "./notification-panel";

export function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setPanelOpen(!panelOpen)}
        className={cn(
          "relative flex items-center justify-center w-9 h-9 rounded-xl",
          "hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
          "transition-colors",
        )}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold px-1"
            style={{ background: "var(--color-destructive)", color: "#fff" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
