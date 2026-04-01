const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

/**
 * Thin fetch wrapper that injects auth token and handles JSON errors uniformly.
 * For file uploads, pass FormData as body and omit Content-Type so the browser
 * sets the multipart boundary automatically.
 */
export async function fetchApi(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<unknown> {
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(
      (body as { error?: string }).error || `HTTP ${res.status}`
    );
  }

  return res.json();
}
