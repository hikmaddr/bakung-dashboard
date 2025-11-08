export class HttpError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.data = data;
  }
}

export type ApiOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
};

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", headers = {}, body, signal } = options;

  const isJsonBody = body && typeof body === "object" && !(body instanceof FormData);

  const res = await fetch(url, {
    method,
    headers: {
      ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: isJsonBody
      ? JSON.stringify(body)
      : (body as BodyInit | null | undefined),
    signal,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data: unknown = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof data === "string"
        ? data
        : (data as { message?: string })?.message ||
          `Request failed: ${res.status}`;
    throw new HttpError(message, res.status, data);
  }

  return data as T;
}

export const api = {
  get: <T = unknown>(
    url: string,
    options: Omit<ApiOptions, "method" | "body"> = {}
  ) => apiFetch<T>(url, { ...options, method: "GET" }),
  post: <T = unknown>(
    url: string,
    body?: unknown,
    options: Omit<ApiOptions, "method"> = {}
  ) => apiFetch<T>(url, { ...options, method: "POST", body }),
  put: <T = unknown>(
    url:string,
    body?: unknown,
    options: Omit<ApiOptions, "method"> = {}
  ) => apiFetch<T>(url, { ...options, method: "PUT", body }),
  patch: <T = unknown>(
    url: string,
    body?: unknown,
    options: Omit<ApiOptions, "method"> = {}
  ) => apiFetch<T>(url, { ...options, method: "PATCH", body }),
  delete: <T = unknown>(
    url: string,
    options: Omit<ApiOptions, "method" | "body"> = {}
  ) => apiFetch<T>(url, { ...options, method: "DELETE" }),
};
