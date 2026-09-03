import { describe, test, expect } from "bun:test"
import {
  verifyWebhookSignature,
  parseWebhookEvent,
  createWebhookHandler,
} from "../src/webhook.ts"
import { generateSignature } from "./helpers/webhookHelpers.ts"

const SECRET = "test-webhook-secret-32-chars-long"
const PAYLOAD = JSON.stringify({
  event: "message",
  session_id: "sess-1",
  data: { id: "msg_1", from: "5511999999999", text: "Hello" },
  timestamp: "2026-09-03T12:00:00Z",
})

// ─── verifyWebhookSignature ───────────────────────────────────────────────────

describe("verifyWebhookSignature", () => {
  test("returns true for a valid signature", async () => {
    const sig = await generateSignature(PAYLOAD, SECRET)
    expect(await verifyWebhookSignature(PAYLOAD, sig, SECRET)).toBe(true)
  })

  test("returns false for an invalid signature", async () => {
    const sig = "sha256=0000000000000000000000000000000000000000000000000000000000000000"
    expect(await verifyWebhookSignature(PAYLOAD, sig, SECRET)).toBe(false)
  })

  test("returns false for a missing signature", async () => {
    expect(await verifyWebhookSignature(PAYLOAD, "", SECRET)).toBe(false)
  })

  test("returns false for wrong scheme prefix", async () => {
    const validHex = (await generateSignature(PAYLOAD, SECRET)).replace("sha256=", "")
    expect(await verifyWebhookSignature(PAYLOAD, `sha512=${validHex}`, SECRET)).toBe(false)
  })

  test("returns false for signature with no separator", async () => {
    expect(await verifyWebhookSignature(PAYLOAD, "invalidsignature", SECRET)).toBe(false)
  })

  test("returns false when payload is tampered", async () => {
    const sig = await generateSignature(PAYLOAD, SECRET)
    const tampered = PAYLOAD.replace("Hello", "Tampered")
    expect(await verifyWebhookSignature(tampered, sig, SECRET)).toBe(false)
  })

  test("returns false when secret is wrong", async () => {
    const sig = await generateSignature(PAYLOAD, SECRET)
    expect(await verifyWebhookSignature(PAYLOAD, sig, "wrong-secret")).toBe(false)
  })

  test("accepts Uint8Array body", async () => {
    const bytes = new TextEncoder().encode(PAYLOAD)
    const sig = await generateSignature(PAYLOAD, SECRET)
    expect(await verifyWebhookSignature(bytes, sig, SECRET)).toBe(true)
  })
})

// ─── parseWebhookEvent ────────────────────────────────────────────────────────

describe("parseWebhookEvent", () => {
  test("parses a valid event", () => {
    const event = parseWebhookEvent(PAYLOAD)
    expect(event.event).toBe("message")
    expect(event.session_id).toBe("sess-1")
    expect(event.timestamp).toBe("2026-09-03T12:00:00Z")
  })

  test("throws on invalid JSON", () => {
    expect(() => parseWebhookEvent("not-json")).toThrow()
  })
})

// ─── createWebhookHandler ─────────────────────────────────────────────────────

async function makeRequest(body: string, sig: string): Promise<Request> {
  return new Request("https://example.com/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-wi-signature": sig },
    body,
  })
}

describe("createWebhookHandler", () => {
  test("returns 204 for a valid signed request", async () => {
    const handler = createWebhookHandler({ secret: SECRET })
    const sig = await generateSignature(PAYLOAD, SECRET)
    const res = await handler(await makeRequest(PAYLOAD, sig))
    expect(res.status).toBe(204)
  })

  test("returns 401 for invalid signature", async () => {
    const handler = createWebhookHandler({ secret: SECRET })
    const res = await handler(await makeRequest(PAYLOAD, "sha256=bad"))
    expect(res.status).toBe(401)
  })

  test("returns 401 for missing signature", async () => {
    const handler = createWebhookHandler({ secret: SECRET })
    const req = new Request("https://example.com/webhook", {
      method: "POST",
      body: PAYLOAD,
    })
    const res = await handler(req)
    expect(res.status).toBe(401)
  })

  test("returns 400 for invalid JSON body", async () => {
    const handler = createWebhookHandler({ secret: SECRET })
    const sig = await generateSignature("not-json", SECRET)
    const res = await handler(await makeRequest("not-json", sig))
    expect(res.status).toBe(400)
  })

  test("calls onMessage for message events", async () => {
    let received: unknown
    const handler = createWebhookHandler({
      secret: SECRET,
      onMessage: (event) => { received = event },
    })
    const sig = await generateSignature(PAYLOAD, SECRET)
    await handler(await makeRequest(PAYLOAD, sig))
    expect((received as { event: string }).event).toBe("message")
  })

  test("calls onConnected for connected events", async () => {
    let received: unknown
    const handler = createWebhookHandler({
      secret: SECRET,
      onConnected: (event) => { received = event },
    })
    const connectedPayload = JSON.stringify({
      event: "connected",
      session_id: "sess-1",
      data: { phone: "5511999999999" },
      timestamp: "2026-09-03T12:00:00Z",
    })
    const sig = await generateSignature(connectedPayload, SECRET)
    await handler(await makeRequest(connectedPayload, sig))
    expect((received as { event: string }).event).toBe("connected")
  })

  test("calls onEvent for any event type", async () => {
    const events: unknown[] = []
    const handler = createWebhookHandler({
      secret: SECRET,
      onEvent: (event) => { events.push(event) },
    })
    const sig = await generateSignature(PAYLOAD, SECRET)
    await handler(await makeRequest(PAYLOAD, sig))
    expect(events).toHaveLength(1)
  })

  test("returns 500 when handler throws", async () => {
    const original = console.error
    console.error = () => {}
    try {
      const handler = createWebhookHandler({
        secret: SECRET,
        onMessage: async () => { throw new Error("handler crashed") },
      })
      const sig = await generateSignature(PAYLOAD, SECRET)
      const res = await handler(await makeRequest(PAYLOAD, sig))
      expect(res.status).toBe(500)
    } finally {
      console.error = original
    }
  })
})
