import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { useWebSocket } from "@/hooks/use-websocket";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

interface NotificationEvent {
  type: string;
  data: Record<string, unknown>;
}

interface NotificationContextValue {
  unreadCount: number;
  /** Active classroom WS connection */
  connected: boolean;
  /** Refresh unread count from API */
  refreshCount: () => void;
  /** Set which classroom to connect to (null to disconnect) */
  setActiveClassroom: (classroomId: string | null) => void;
  /** Latest event for toast display */
  latestEvent: NotificationEvent | null;
  clearLatestEvent: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  connected: false,
  refreshCount: () => {},
  setActiveClassroom: () => {},
  latestEvent: null,
  clearLatestEvent: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeClassroom, setActiveClassroom] = useState<string | null>(null);
  const [latestEvent, setLatestEvent] = useState<NotificationEvent | null>(null);
  const [wsUrl, setWsUrl] = useState("");

  // Build WebSocket URL when active classroom changes (with auth token in query param)
  useEffect(() => {
    if (!activeClassroom) {
      setWsUrl("");
      return;
    }
    (async () => {
      const token = await getToken();
      if (!token) return;
      const wsBase = API_URL.replace(/^http/, "ws");
      setWsUrl(`${wsBase}/ws/classroom/${activeClassroom}?token=${encodeURIComponent(token)}`);
    })();
  }, [activeClassroom, getToken]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const parsed = JSON.parse(event.data) as NotificationEvent;
      setLatestEvent(parsed);
      setUnreadCount((c) => c + 1);

      // Invalidate relevant queries based on event type
      if (parsed.type === "mention" || parsed.type === "comment_reply") {
        queryClient.invalidateQueries({ queryKey: ["comments"] });
        queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      } else if (parsed.type === "announcement" || parsed.type === "assessment_assigned") {
        queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      }
    } catch { /* ignore malformed messages */ }
  }, [queryClient]);

  const { connected } = useWebSocket({
    url: wsUrl,
    enabled: !!wsUrl,
    onMessage: handleMessage,
  });

  // Fetch initial unread count
  const refreshCount = useCallback(async () => {
    try {
      const token = await getToken();
      const data = (await fetchApi("/api/notifications/unread-count", {}, token)) as { count: number };
      setUnreadCount(data.count);
    } catch { /* silent fail */ }
  }, [getToken]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  const clearLatestEvent = useCallback(() => setLatestEvent(null), []);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, connected, refreshCount, setActiveClassroom, latestEvent, clearLatestEvent }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
