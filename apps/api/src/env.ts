/**
 * Cloudflare Workers environment bindings and variables.
 * Used as the Hono generic type parameter: new Hono<Env>()
 */
export type Env = {
  Bindings: {
    DB: D1Database;
    STORAGE: R2Bucket;
    NOTIFICATION_HUB: DurableObjectNamespace;
    CLERK_PUBLISHABLE_KEY: string;
    CLERK_SECRET_KEY: string;
    CORS_ORIGIN: string;
    CLERK_WEBHOOK_SECRET?: string;
  };
};
