/**
 * Durable Object that manages WebSocket connections per classroom.
 * Each classroom gets its own NotificationHub instance.
 * Workers API calls broadcast() to push events to connected clients.
 */
export class NotificationHub implements DurableObject {
  private sessions: Map<string, WebSocket> = new Map();
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
    // Restore hibernated WebSocket sessions
    this.state.getWebSockets().forEach((ws) => {
      const meta = ws.deserializeAttachment() as { userId: string } | null;
      if (meta?.userId) this.sessions.set(meta.userId, ws);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal broadcast endpoint (called by Worker API)
    if (url.pathname === "/broadcast" && request.method === "POST") {
      const event = await request.json();
      this.broadcast(event as { type: string; data: unknown; recipients?: string[]; senderId?: string });
      return new Response("ok");
    }

    // WebSocket upgrade
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const userId = url.searchParams.get("userId");
    if (!userId) {
      return new Response("Missing userId", { status: 400 });
    }

    // Close existing connection for this user (reconnect scenario)
    const existing = this.sessions.get(userId);
    if (existing) {
      try { existing.close(1000, "reconnect"); } catch { /* already closed */ }
      this.sessions.delete(userId);
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.state.acceptWebSocket(server);
    server.serializeAttachment({ userId });
    this.sessions.set(userId, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Handle incoming WebSocket messages (ping/pong keepalive) */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message === "ping") {
      ws.send("pong");
    }
  }

  /** Clean up on WebSocket close */
  async webSocketClose(ws: WebSocket, code: number) {
    const meta = ws.deserializeAttachment() as { userId: string } | null;
    if (meta?.userId) {
      this.sessions.delete(meta.userId);
    }
  }

  /** Clean up on WebSocket error */
  async webSocketError(ws: WebSocket) {
    const meta = ws.deserializeAttachment() as { userId: string } | null;
    if (meta?.userId) {
      this.sessions.delete(meta.userId);
    }
  }

  /** Broadcast event to connected clients, optionally filtered by recipients */
  private broadcast(event: { type: string; data: unknown; recipients?: string[]; senderId?: string }) {
    const message = JSON.stringify({ type: event.type, data: event.data });
    const recipients = event.recipients ? new Set(event.recipients) : null;

    for (const [userId, ws] of this.sessions) {
      // Skip sender
      if (event.senderId && userId === event.senderId) continue;
      // Filter to specific recipients if provided
      if (recipients && !recipients.has(userId)) continue;

      try {
        ws.send(message);
      } catch {
        // Connection broken, clean up
        this.sessions.delete(userId);
      }
    }
  }
}
