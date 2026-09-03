import type { WebhookEvent, WebhookHandlerOptions } from "./types.ts"

const SIGNATURE_HEADER = "x-wi-signature"

/**
 * Verify a webhook signature.
 *
 * The server signs the raw body with HMAC-SHA256 and sends it as:
 *   x-wi-signature: sha256=<hex>
 *
 * @param rawBody - The raw request body as a string or Uint8Array
 * @param signature - Value of the x-wi-signature header
 * @param secret - Your webhook secret
 */
export async function verifyWebhookSignature(
  rawBody: string | Uint8Array,
  signature: string,
  secret: string,
): Promise<boolean> {
  const [scheme, hex] = signature.split("=", 2)
  if (scheme !== "sha256" || !hex) return false

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )

  const bodyBytes = typeof rawBody === "string" ? enc.encode(rawBody) : rawBody
  const mac = await crypto.subtle.sign("HMAC", key, bodyBytes.buffer as ArrayBuffer)
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // Constant-time comparison
  if (expected.length !== hex.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ hex.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Parse a raw webhook body into a typed WebhookEvent.
 */
export function parseWebhookEvent(body: string): WebhookEvent {
  return JSON.parse(body) as WebhookEvent
}

/**
 * Create a fetch-compatible webhook handler (works with Next.js App Router,
 * Bun.serve, Hono, Elysia, Cloudflare Workers, and any Web API runtime).
 *
 * @example
 * // Next.js App Router
 * export const POST = createWebhookHandler({ secret: "...", onMessage: ... })
 *
 * @example
 * // Hono
 * app.post("/webhook", createWebhookHandler({ secret: "...", onMessage: ... }))
 *
 * @example
 * // Bun.serve
 * fetch: createWebhookHandler({ secret: "...", onMessage: ... })
 */
export function createWebhookHandler(
  options: WebhookHandlerOptions,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const signature = req.headers.get(SIGNATURE_HEADER) ?? ""
    const rawBody = await req.text()

    const valid = await verifyWebhookSignature(rawBody, signature, options.secret)
    if (!valid) {
      return new Response("Invalid signature", { status: 401 })
    }

    let event: WebhookEvent
    try {
      event = parseWebhookEvent(rawBody)
    } catch {
      return new Response("Invalid JSON", { status: 400 })
    }

    try {
      await options.onEvent?.(event)

      switch (event.event) {
        case "message":
          await options.onMessage?.(event as WebhookEvent<Parameters<NonNullable<typeof options.onMessage>>[0]["data"]>)
          break
        case "message.sent":
          await options.onMessageSent?.(event as WebhookEvent<Parameters<NonNullable<typeof options.onMessageSent>>[0]["data"]>)
          break
        case "connected":
          await options.onConnected?.(event as WebhookEvent<{ phone: string }>)
          break
        case "disconnected":
          await options.onDisconnected?.(event as WebhookEvent<Record<string, never>>)
          break
        case "qr":
          await options.onQR?.(event as WebhookEvent<{ qr: string }>)
          break
      }
    } catch (err) {
      console.error("[wi-api] webhook handler error:", err)
      return new Response("Internal error", { status: 500 })
    }

    return new Response(null, { status: 204 })
  }
}

/**
 * Express/Connect middleware adapter.
 *
 * @example
 * app.post("/webhook", expressWebhookMiddleware({ secret: "...", onMessage: ... }))
 */
export function expressWebhookMiddleware(options: WebhookHandlerOptions) {
  const handler = createWebhookHandler(options)
  return async (
    req: { headers: Record<string, string | string[] | undefined>; body?: unknown; rawBody?: string },
    res: { status: (code: number) => { send: (body: string) => void; end: () => void } },
  ) => {
    // Express with raw body — prefer rawBody string, fall back to JSON-serialized body
    const rawBody =
      typeof req.rawBody === "string"
        ? req.rawBody
        : JSON.stringify(req.body ?? {})

    const headers = new Headers()
    for (const [key, val] of Object.entries(req.headers)) {
      if (typeof val === "string") headers.set(key, val)
      else if (Array.isArray(val)) headers.set(key, val.join(", "))
    }

    const fakeReq = new Request("https://webhook", {
      method: "POST",
      headers,
      body: rawBody,
    })

    const fakeRes = await handler(fakeReq)
    if (fakeRes.status === 204) return res.status(204).end()
    const text = await fakeRes.text()
    res.status(fakeRes.status).send(text)
  }
}
