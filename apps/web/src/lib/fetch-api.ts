const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

function sanitizeErrorMessage(body: { error?: string }, status: number): string {
  if (status === 401) return "Session expired. Please refresh the page.";
  if (status === 403) return body.error || "You don't have permission to do this.";
  return body.error || `Request failed (${status})`;
}

function doFetch(
  path: string,
  options: RequestInit,
  token?: string | null,
): Promise<Response> {
  const isFormData = options.body instanceof FormData;
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

/**
 * Thin fetch wrapper that injects auth token and handles JSON errors uniformly.
 * For file uploads, pass FormData as body and omit Content-Type so the browser
 * sets the multipart boundary automatically.
 *
 * Pass `getToken` to enable automatic retry on 401 with a fresh token.
 */
export async function fetchApi(
  path: string,
  options: RequestInit = {},
  token?: string | null,
  getToken?: () => Promise<string | null>,
): Promise<unknown> {
  const res = await doFetch(path, options, token);

  // Retry once on 401 with a fresh token
  if (res.status === 401 && getToken) {
    try {
      const freshToken = await getToken();
      if (freshToken && freshToken !== token) {
        const retryRes = await doFetch(path, options, freshToken);
        if (!retryRes.ok) {
          const body = await retryRes.json().catch(() => ({ error: "Request failed" }));
          throw new Error(sanitizeErrorMessage(body as { error?: string }, retryRes.status));
        }
        if (retryRes.status === 204) return null;
        return retryRes.json();
      }
    } catch (e) {
      // Re-throw sanitized errors from the retry path; swallow token-refresh failures
      if (e instanceof Error && e.message.includes("Session expired")) throw e;
      if (e instanceof Error && e.message.includes("Request failed")) throw e;
      // getToken() itself failed — fall through to original 401 handling below
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(sanitizeErrorMessage(body as { error?: string }, res.status));
  }

  if (res.status === 204) return null;
  return res.json();
}
