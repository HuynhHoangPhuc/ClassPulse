import { MessageSquare, AtSign, FileText, Megaphone } from "lucide-react";

interface NotificationData {
  id: string;
  type: string;
  message: string;
  referenceType: string;
  referenceId: string;
  isRead: number;
  createdAt: number;
}

interface NotificationItemProps {
  notification: NotificationData;
  onMarkRead: (id: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const iconMap: Record<string, typeof MessageSquare> = {
  mention: AtSign,
  comment_reply: MessageSquare,
  assessment_assigned: FileText,
  announcement: Megaphone,
};

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const Icon = iconMap[notification.type] ?? MessageSquare;
  const isUnread = notification.isRead === 0;

  return (
    <button
      type="button"
      onClick={() => { if (isUnread) onMarkRead(notification.id); }}
      className="flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-[var(--color-muted)]"
      style={{
        borderLeft: isUnread ? "3px solid var(--color-primary)" : "3px solid transparent",
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
          color: "var(--color-primary)",
        }}
      >
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm leading-snug"
          style={{
            color: "var(--color-foreground)",
            fontWeight: isUnread ? 600 : 400,
          }}
        >
          {notification.message}
        </p>
        <span className="text-[10px]" style={{ color: "var(--color-muted-foreground)" }}>
          {timeAgo(notification.createdAt)}
        </span>
      </div>
    </button>
  );
}
