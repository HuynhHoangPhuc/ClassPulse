import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useNotifications } from "./notification-provider";

const typeLabels: Record<string, string> = {
  mention: "You were mentioned",
  comment_reply: "New reply to your comment",
  announcement: "New announcement",
  assessment_assigned: "Assessment assigned",
};

/** Auto-dismissing toast for real-time notification events */
export function NotificationToast() {
  const { latestEvent, clearLatestEvent } = useNotifications();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!latestEvent) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      clearLatestEvent();
    }, 5000);
    return () => clearTimeout(timer);
  }, [latestEvent, clearLatestEvent]);

  if (!visible || !latestEvent) return null;

  const label = typeLabels[latestEvent.type] ?? "Notification";

  return (
    <div
      className="fixed top-4 right-4 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-in slide-in-from-top-2 max-w-sm"
      style={{
        background: "var(--color-card)",
        borderColor: "var(--color-primary)",
      }}
    >
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: "var(--color-primary)" }}
      />
      <span className="text-sm flex-1" style={{ color: "var(--color-foreground)" }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => { setVisible(false); clearLatestEvent(); }}
        className="p-0.5 rounded hover:bg-[var(--color-muted)]"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
