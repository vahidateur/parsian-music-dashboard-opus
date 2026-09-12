import { vi, type Mock } from "vitest";

export type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;
export type FetchMock = Mock<(url: string, init?: RequestInit) => Promise<Response>>;

/** Typed fetch double so tests can assert on the constructed request. */
export function createFetchMock(handler: FetchHandler): FetchMock {
  return vi.fn(async (url: string, init?: RequestInit) => handler(url, init)) as FetchMock;
}

export function asFetch(mock: FetchMock): typeof fetch {
  return mock as unknown as typeof fetch;
}

export function requestOf(mock: FetchMock, index = 0): { url: string; init: RequestInit; headers: Record<string, string> } {
  const call = mock.mock.calls[index];
  if (!call) throw new Error(`fetch was not called ${index + 1} time(s)`);
  const [url, init] = call;
  const resolved = init ?? {};
  return { url, init: resolved, headers: (resolved.headers ?? {}) as Record<string, string> };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
