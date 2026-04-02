import { useEffect, useRef, useCallback, useState } from "react";

interface UseWebSocketOptions {
  url: string;
  enabled?: boolean;
  onMessage?: (event: MessageEvent) => void;
  /** Ping interval in ms (default: 30000) */
  pingInterval?: number;
}

/**
 * WebSocket hook with automatic reconnection (exponential backoff)
 * and ping/pong keepalive.
 */
export function useWebSocket({ url, enabled = true, onMessage, pingInterval = 30_000 }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pingTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (!enabled) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCountRef.current = 0;
      setConnected(true);
      // Start ping keepalive
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, pingInterval);
    };

    ws.onmessage = (event) => {
      if (event.data === "pong") return;
      onMessage?.(event);
    };

    ws.onclose = () => {
      setConnected(false);
      clearInterval(pingTimerRef.current);
      // Exponential backoff reconnect: 1s, 2s, 4s, ... max 30s
      const delay = Math.min(1000 * 2 ** retryCountRef.current, 30_000);
      retryCountRef.current++;
      retryTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url, enabled, onMessage, pingInterval]);

  useEffect(() => {
    if (!enabled) return;
    connect();

    return () => {
      clearTimeout(retryTimerRef.current);
      clearInterval(pingTimerRef.current);
      retryCountRef.current = 0;
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [connect, enabled]);

  return { connected };
}
