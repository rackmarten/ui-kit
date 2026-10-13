// A small JSON client for an app's own API, so each app doesn't carry its
// own copy of the same fetch wrapper.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    // The parsed JSON error body, the raw text if it wasn't JSON, or null.
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiOptions {
  // Prefix for every path.
  baseUrl?: string;
  // Extra headers per request, read each time (auth, a client marker, ...).
  headers?: () => Record<string, string>;
  // Defaults merged into every request, e.g. { keepalive: true }.
  init?: RequestInit;
  // Called on a 401 before the ApiError is thrown (e.g. to redirect to login).
  onUnauthorized?: (response: Response) => void;
  fetch?: typeof fetch;
}

export interface Api {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  // Same headers and 401 handling, but no parsing and no throw on !ok.
  raw(path: string, init?: RequestInit): Promise<Response>;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
}

// Bodies fetch already knows how to send; anything else is JSON.
const isNativeBody = (body: unknown): boolean =>
  typeof body === "string" ||
  body instanceof FormData ||
  body instanceof Blob ||
  body instanceof ArrayBuffer ||
  ArrayBuffer.isView(body) ||
  body instanceof URLSearchParams ||
  (typeof ReadableStream !== "undefined" && body instanceof ReadableStream);

const readBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (text === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const errorMessage = (body: unknown, path: string, status: number): string => {
  if (body && typeof body === "object") {
    const { error, message } = body as { error?: unknown; message?: unknown };
    if (typeof error === "string" && error) return error;
    if (typeof message === "string" && message) return message;
  }
  return `${path} -> ${String(status)}`;
};

export const createApi = (options: ApiOptions = {}): Api => {
  const base = options.baseUrl ?? "";
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));

  const raw = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.init?.headers);
    for (const [name, value] of Object.entries(options.headers?.() ?? {})) {
      headers.set(name, value);
    }
    for (const [name, value] of new Headers(init.headers)) headers.set(name, value);
    const response = await doFetch(`${base}${path}`, { ...options.init, ...init, headers });
    if (response.status === 401) options.onUnauthorized?.(response);
    return response;
  };

  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await raw(path, init);
    const body = await readBody(response);
    if (!response.ok) {
      throw new ApiError(
        errorMessage(body, path, response.status),
        response.status,
        path,
        body ?? null,
      );
    }
    return body as T;
  };

  const send = <T>(method: string, path: string, body?: unknown): Promise<T> => {
    // No body, no content-type: Fastify rejects an empty JSON body.
    if (body === undefined) return request<T>(path, { method });
    if (isNativeBody(body)) return request<T>(path, { method, body: body as BodyInit });
    return request<T>(path, {
      method,
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  };

  return {
    request,
    raw,
    get: (path) => request(path),
    post: (path, body) => send("POST", path, body),
    put: (path, body) => send("PUT", path, body),
    patch: (path, body) => send("PATCH", path, body),
    del: (path) => send("DELETE", path),
  };
};
