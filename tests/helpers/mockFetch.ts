import type { WiConfig } from "../../src/types.ts"

export type CapturedRequest = {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

type MockResponse = {
  status?: number
  body?: unknown
  headers?: Record<string, string>
}

/**
 * Creates an injectable fetch function that captures outgoing requests
 * and returns pre-configured responses. Pass the result as `fetch` in WiConfig.
 *
 * Based on the pattern used by Anthropic and OpenAI TypeScript SDKs.
 */
export function mockFetch(responses: MockResponse | MockResponse[]): {
  fetch: Required<WiConfig>["fetch"]
  requests: CapturedRequest[]
} {
  const queue = Array.isArray(responses) ? responses : [responses]
  const requests: CapturedRequest[] = []
  let callCount = 0

  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init)

    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => { headers[key] = value })

    let body: unknown
    const ct = req.headers.get("content-type") ?? ""
    if (ct.includes("application/json")) {
      try { body = await req.clone().json() } catch {}
    } else {
      const text = await req.clone().text()
      if (text) body = text
    }

    requests.push({ url: req.url, method: req.method, headers, body })

    const spec = queue[Math.min(callCount++, queue.length - 1)] ?? {}
    return new Response(
      spec.body !== undefined ? JSON.stringify(spec.body) : null,
      {
        status: spec.status ?? 200,
        headers: { "content-type": "application/json", ...spec.headers },
      },
    )
  }

  return { fetch: fetchFn as Required<WiConfig>["fetch"], requests }
}

/**
 * A fetch that always throws a network error (simulates offline / DNS failure).
 */
export const networkErrorFetch: Required<WiConfig>["fetch"] = async () => {
  throw new TypeError("Failed to fetch")
}

/**
 * A fetch that never resolves (simulates a hung connection).
 * Respects the AbortSignal passed in init so timeout tests work correctly.
 */
export const hangingFetch: Required<WiConfig>["fetch"] = (
  _input: RequestInfo | URL,
  init?: RequestInit,
) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("The operation was aborted.", "AbortError")),
    )
  })
