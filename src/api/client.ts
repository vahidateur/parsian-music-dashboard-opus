import { ApiError, apiErrorFromResponse, apiErrorFromThrown } from "./errors";
import type { CollectionEnvelope, ItemEnvelope, Page, PageMeta, QueryParams, RequestOptions } from "./types";

/**
 * Minimal HTTP boundary. It knows about JSON, query strings, auth headers and
 * the response envelope — and nothing about students, sessions or invoices.
 */

export type AuthTokenProvider = () => string | null | undefined | Promise<string | null | undefined>;

/**
 * A binary payload for an upload.
 *
 * The bytes are sent as `multipart/form-data` — one part for the file, the
 * metadata as ordinary fields — because the server must NOT trust the
 * declared type: it re-derives it from the bytes. A `Blob` (rather than a
 * base64 string) keeps a 5 MB photo out of the JSON envelope and out of
 * memory twice.
 */
export interface BinaryUpload {
  /** The display name of the file. Never used to build a path by the server. */
  filename: string;
  /** The type the CLIENT believes the file has. The server verifies it. */
  mimeType: string;
  bytes: ArrayBuffer;
  /** Extra form fields — the metadata that travels with the bytes. */
  fields?: Record<string, string | number | boolean | undefined>;
}

export interface UnauthenticatedContext {
  authorization: string | null;
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Called before each request to attach `Authorization: Bearer …`. */
  getToken?: AuthTokenProvider;
  /**
   * Invoked once whenever the server answers 401 (session expiry hook).
   *
   * `context.authorization` is the `Authorization` header the rejected request
   * actually carried (`null` when it carried none). A 401 only speaks for that
   * credential, so a subscriber that has since moved on to a different one can
   * tell a stale rejection from a real session end.
   */
  onUnauthenticated?: (error?: ApiError, context?: UnauthenticatedContext) => void;
  /** Per-request timeout in ms. 0 disables it. */
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export function buildQueryString(query: QueryParams | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(`${key}[]`, String(item));
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export class ApiClient {
  private readonly config: Required<Pick<ApiClientConfig, "baseUrl" | "timeoutMs">> & ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = { timeoutMs: 15_000, ...config, baseUrl: config.baseUrl };
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("GET", path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>("POST", path, body, options);
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>("PATCH", path, body, options);
  }

  delete<T = void>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("DELETE", path, undefined, options);
  }

  /**
   * Uploads bytes as `multipart/form-data`.
   *
   * The `Content-Type` header is deliberately NOT set: the browser has to
   * add the multipart boundary itself, and a hand-written header would strip
   * it. The auth header and the timeout work exactly as they do for JSON.
   */
  async postBinary<T>(path: string, upload: BinaryUpload, options?: RequestOptions): Promise<T> {
    const form = new FormData();
    for (const [key, value] of Object.entries(upload.fields ?? {})) {
      if (value === undefined) continue;
      form.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
    }
    form.append("file", new Blob([upload.bytes], { type: upload.mimeType }), upload.filename);

    const { response, authorization } = await this.send("POST", path, {
      body: form,
      accept: "application/json",
      options,
    });

    const payload = await readBody(response);
    if (!response.ok) {
      const error = apiErrorFromResponse(response.status, payload);
      if (error.kind === "authentication") this.config.onUnauthenticated?.(error, { authorization });
      throw error;
    }

    return payload !== null && typeof payload === "object" && "data" in payload
      ? ((payload as ItemEnvelope<T>).data as T)
      : (payload as T);
  }

  /**
   * Fetches raw bytes.
   *
   * The only way the panel reads a stored binary: the server authorizes the
   * READER against the record that shows the file, so the bytes never travel
   * on a public URL.
   */
  async getBinary(path: string, options?: RequestOptions): Promise<Blob> {
    const { response, authorization } = await this.send("GET", path, { accept: "*/*", options });

    if (!response.ok) {
      const payload = await readBody(response).catch(() => null);
      const error = apiErrorFromResponse(response.status, payload);
      if (error.kind === "authentication") this.config.onUnauthenticated?.(error, { authorization });
      throw error;
    }

    return response.blob();
  }

  /** GET a collection endpoint and normalize it into a `Page<T>`. */
  async getPage<T>(path: string, options?: RequestOptions): Promise<Page<T>> {
    const envelope = await this.requestEnvelope<CollectionEnvelope<T>>("GET", path, undefined, options);
    const data = Array.isArray(envelope?.data) ? envelope.data : [];
    return { data, meta: normalizeMeta(envelope?.meta, data.length, options?.query) };
  }

  /** Unwraps `{ data }` for single-resource endpoints. */
  private async request<T>(method: Method, path: string, body: unknown, options?: RequestOptions): Promise<T> {
    const envelope = await this.requestEnvelope<ItemEnvelope<T> | null>(method, path, body, options);
    if (envelope === null || envelope === undefined) return undefined as T;
    if (typeof envelope === "object" && "data" in envelope) return (envelope as ItemEnvelope<T>).data;
    return envelope as unknown as T;
  }

  private async requestEnvelope<T>(method: Method, path: string, body: unknown, options?: RequestOptions): Promise<T> {
    const { response, authorization } = await this.send(method, path, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      accept: "application/json",
      options,
    });

    const payload = await readBody(response);

    if (!response.ok) {
      const error = apiErrorFromResponse(response.status, payload);
      if (error.kind === "authentication") this.config.onUnauthenticated?.(error, { authorization });
      throw error;
    }

    return payload as T;
  }

  /**
   * The one place a request leaves: the auth header, the timeout, the abort
   * plumbing and the transport error mapping. JSON and binary travel the same
   * road, so a binary upload cannot accidentally skip the bearer token.
   */
  private async send(
    method: Method,
    path: string,
    init: {
      body?: BodyInit;
      headers?: Record<string, string>;
      accept?: string;
      options?: RequestOptions;
    },
  ): Promise<{ response: Response; authorization: string | null }> {
    const url = joinUrl(this.config.baseUrl, path) + buildQueryString(init.options?.query);
    const headers: Record<string, string> = {
      Accept: init.accept ?? "application/json",
      ...this.config.defaultHeaders,
      ...init.headers,
      ...init.options?.headers,
    };

    const token = this.config.getToken ? await this.config.getToken() : undefined;
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const external = init.options?.signal;
    if (external) {
      if (external.aborted) controller.abort(external.reason);
      else external.addEventListener("abort", () => controller.abort(external.reason), { once: true });
    }
    const timeout =
      this.config.timeoutMs > 0
        ? setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), this.config.timeoutMs)
        : undefined;

    const fetchImpl = this.config.fetchImpl ?? globalThis.fetch;

    try {
      const response = await fetchImpl(url, {
        method,
        headers,
        body: init.body,
        signal: controller.signal,
      });
      return { response, authorization: headers.Authorization ?? null };
    } catch (error) {
      throw apiErrorFromThrown(controller.signal.reason ?? error);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Non-JSON body from a proxy/gateway — surface it as a server error payload.
    if (response.ok) {
      throw new ApiError({ kind: "server", status: response.status, message: "پاسخ سرور قابل خواندن نیست.", payload: text });
    }
    return { error: { message: text } };
  }
}

function normalizeMeta(meta: Partial<PageMeta> | undefined, count: number, query: QueryParams | undefined): PageMeta {
  const page = meta?.page ?? numeric(query?.page) ?? 1;
  const perPage = meta?.per_page ?? numeric(query?.per_page) ?? (count || 25);
  return { page, per_page: perPage, total: meta?.total ?? count };
}

function numeric(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
