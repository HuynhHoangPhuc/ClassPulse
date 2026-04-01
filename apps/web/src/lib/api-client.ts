import { Hono } from "hono";
import { hc } from "hono/client";

// Type-safe RPC: import AppType from @teaching/api once CF types are resolved
// across the monorepo boundary (requires build step or project references).
// For now, use base Hono type — will wire in Phase 2 when adding real API calls.
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8787";

export const api = hc<Hono>(apiUrl);
