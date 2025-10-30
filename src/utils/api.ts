export type ApiOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  signal?: AbortSignal;
};

export async function apiFetch<T = any>(url: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", headers = {}, body, signal } = options;

  const isJsonBody = body && typeof body === "object" && !(body instanceof FormData);

  const res = await fetch(url, {
    method,
    headers: {
      ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: isJsonBody ? JSON.stringify(body) : body,
    signal,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const error = new Error(
      typeof data === "string" ? data : data?.message || `Request failed: ${res.status}`
    );
    // Attach extra info for easier debugging
    (error as any).status = res.status;
    (error as any).data = data;
    throw error;
  }

  return data as T;
}

export const api = {
  get: <T = any>(url: string, options: Omit<ApiOptions, "method" | "body"> = {}) =>
    apiFetch<T>(url, { ...options, method: "GET" }),
  post: <T = any>(url: string, body?: any, options: Omit<ApiOptions, "method"> = {}) =>
    apiFetch<T>(url, { ...options, method: "POST", body }),
  put: <T = any>(url: string, body?: any, options: Omit<ApiOptions, "method"> = {}) =>
    apiFetch<T>(url, { ...options, method: "PUT", body }),
  patch: <T = any>(url: string, body?: any, options: Omit<ApiOptions, "method"> = {}) =>
    apiFetch<T>(url, { ...options, method: "PATCH", body }),
  delete: <T = any>(url: string, options: Omit<ApiOptions, "method" | "body"> = {}) =>
    apiFetch<T>(url, { ...options, method: "DELETE" }),
};

