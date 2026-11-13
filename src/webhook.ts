import type {
  DisconnectedData,
  PairingFailedData,
  PairingSucceededData,
  ReceiptData,
  WebhookEvent,
  WebhookHandlerOptions,
  WebhookHeaders,
} from "./types.ts"

const SIGNATURE_HEADER = "x-wi-signature"
const SIGNATURE_V2_HEADER = "x-wi-signature-v2"
const DEFAULT_TOLERANCE_SECONDS = 300

async function hmacHex(secret: string, data: string | Uint8Array): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const bytes = typeof data === "string" ? enc.encode(data) : data
  const mac = await crypto.subtle.sign("HMAC", key, bytes.buffer as ArrayBuffer)
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

function headerValue(headers: WebhookHeaders, name: string): string | undefined {
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) ?? undefined
  }
  const record = headers as Record<string, string | string[] | undefined>
  const key = Object.keys(record).find((k) => k.toLowerCase() === name)
  const val = key ? record[key] : undefined
  return Array.isArray(val) ? val[0] : val
}

export interface VerifyWebhookOptions {
  /** Max age (or clock skew) of `x-wi-timestamp`, in seconds. Default 300 (5 minutes). */
  toleranceSeconds?: number
  /** Current time in unix seconds; for tests. */
  now?: number
}

/**
 * Verify a webhook delivery with replay protection.
 *
 * Checks `x-wi-signature-v2: t=<unix seconds>,v1=<hex>`, the HMAC-SHA256 of
 * `<t>.<rawBody>`, and rejects it when `t` is further than `toleranceSeconds`
 * (default 300) from now: a captured request cannot be replayed later, and a
 * tampered timestamp fails the signature. Deliveries that carry no v2 header
 * (older servers) fall back to the legacy `x-wi-signature` body signature,
 * which has no replay protection.
 *
 * @param rawBody - The raw request body, exactly as received
 * @param headers - Request headers (`Headers` or a plain object)
 * @param secret - Your webhook secret
 */
export async function verifyWebhook(
  rawBody: string | Uint8Array,
  headers: WebhookHeaders,
  secret: string,
  options: VerifyWebhookOptions = {},
): Promise<boolean> {
  const v2 = headerValue(headers, SIGNATURE_V2_HEADER)
  if (v2 === undefined) {
    const legacy = headerValue(headers, SIGNATURE_HEADER)
    return legacy ? verifyWebhookSignature(rawBody, legacy, secret) : false
  }

  const parts = Object.fromEntries(
    v2.split(",").map((p) => {
      const i = p.indexOf("=")
      return i < 0 ? [p.trim(), ""] : [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    }),
  ) as Record<string, string>
  const t = Number(parts.t)
  if (!parts.t || !Number.isInteger(t) || !parts.v1) return false

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS
  const now = options.now ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - t) > tolerance) return false

  const body =
    typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody)
  return safeEqual(await hmacHex(secret, `${t}.${body}`), parts.v1)
}

/**
 * Verify the legacy body-only webhook signature (no replay protection).
 * Prefer {@link verifyWebhook}.
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
  return safeEqual(await hmacHex(secret, rawBody), hex)
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
    const rawBody = await req.text()

    const valid = await verifyWebhook(
      rawBody,
      req.headers,
      options.secret,
      options.toleranceSeconds === undefined
        ? {}
        : { toleranceSeconds: options.toleranceSeconds },
    )
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
        case "receipt":
          await options.onReceipt?.(event as WebhookEvent<ReceiptData>)
          break
        case "connected":
          await options.onConnected?.(event as WebhookEvent<{ phone: string }>)
          break
        case "disconnected":
          await options.onDisconnected?.(event as WebhookEvent<DisconnectedData>)
          break
        case "qr":
          await options.onQR?.(event as WebhookEvent<{ qr: string }>)
          break
        case "pairing.failed":
          await options.onPairingFailed?.(event as WebhookEvent<PairingFailedData>)
          break
        case "pairing.succeeded":
          await options.onPairingSucceeded?.(event as WebhookEvent<PairingSucceededData>)
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
