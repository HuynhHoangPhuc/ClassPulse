import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, CheckCheck } from "lucide-react";
import { fetchApi } from "@/lib/fetch-api";
import { useNotifications } from "./notification-provider";
import { NotificationItem } from "./notification-item";

interface NotificationData {
  id: string;
  type: string;
  message: string;
  referenceType: string;
  referenceId: string;
  isRead: number;
  createdAt: number;
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

function groupByTime(items: NotificationData[]) {
  const now = Date.now();
  const dayMs = 86_400_000;
  const weekMs = dayMs * 7;

  const today: NotificationData[] = [];
  const thisWeek: NotificationData[] = [];
  const earlier: NotificationData[] = [];

  for (const item of items) {
    const age = now - item.createdAt;
    if (age < dayMs) today.push(item);
    else if (age < weekMs) thisWeek.push(item);
    else earlier.push(item);
  }

  return { today, thisWeek, earlier };
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { refreshCount } = useNotifications();

  const { data } = useQuery<{ items: NotificationData[] }>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const token = await getToken();
      return fetchApi("/api/notifications?limit=30", {}, token) as Promise<{ items: NotificationData[] }>;
    },
    enabled: open,
    staleTime: 10_000,
  });

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const items = data?.items ?? [];
  const { today, thisWeek, earlier } = groupByTime(items);

  async function handleMarkRead(id: string) {
    const token = await getToken();
    await fetchApi(`/api/notifications/${id}/read`, { method: "PUT" }, token);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    refreshCount();
  }

  async function handleMarkAllRead() {
    const token = await getToken();
    await fetchApi("/api/notifications/read-all", { method: "PUT" }, token);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    refreshCount();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-50 h-full w-80 max-w-[90vw] border-l shadow-xl flex flex-col"
        style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
            Notifications
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
              style={{ color: "var(--color-primary)" }}
            >
              <CheckCheck size={12} /> Mark all read
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 && (
            <p className="text-sm text-center py-12" style={{ color: "var(--color-muted-foreground)" }}>
              No notifications yet
            </p>
          )}

          {today.length > 0 && (
            <Section label="Today">
              {today.map((n) => <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkRead} />)}
            </Section>
          )}

          {thisWeek.length > 0 && (
            <Section label="This Week">
              {thisWeek.map((n) => <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkRead} />)}
            </Section>
          )}

          {earlier.length > 0 && (
            <Section label="Earlier">
              {earlier.map((n) => <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkRead} />)}
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 py-2" style={{ background: "var(--color-muted)" }}>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}
