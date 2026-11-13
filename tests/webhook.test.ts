import { describe, test, expect } from "bun:test"
import {
  verifyWebhook,
  verifyWebhookSignature,
  parseWebhookEvent,
  createWebhookHandler,
} from "../src/webhook.ts"
import {
  DISCONNECT_REASONS,
  PAIRING_FAILURE_REASONS,
  type DisconnectedData,
  type KnownWebhookEvent,
  type PairingFailedData,
  type PairingSucceededData,
} from "../src/types.ts"
import { generateSignature, generateSignatureV2 } from "./helpers/webhookHelpers.ts"

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

// ─── verifyWebhook (v2: signed timestamp) ─────────────────────────────────────

describe("verifyWebhook", () => {
  const NOW = 1_800_000_000

  test("accepts a fresh x-wi-signature-v2 (Headers and plain object)", async () => {
    const sig = await generateSignatureV2(PAYLOAD, SECRET, NOW)
    const headers = { "x-wi-signature-v2": sig, "x-wi-timestamp": String(NOW) }
    expect(await verifyWebhook(PAYLOAD, headers, SECRET, { now: NOW })).toBe(true)
    expect(
      await verifyWebhook(PAYLOAD, new Headers(headers), SECRET, { now: NOW + 10 }),
    ).toBe(true)
    expect(
      await verifyWebhook(PAYLOAD, { "X-WI-Signature-V2": sig }, SECRET, { now: NOW }),
    ).toBe(true)
  })

  test("rejects a replay outside the tolerance (default 5 minutes), accepts it inside", async () => {
    const headers = { "x-wi-signature-v2": await generateSignatureV2(PAYLOAD, SECRET, NOW) }
    expect(await verifyWebhook(PAYLOAD, headers, SECRET, { now: NOW + 299 })).toBe(true)
    expect(await verifyWebhook(PAYLOAD, headers, SECRET, { now: NOW + 301 })).toBe(false)
    expect(await verifyWebhook(PAYLOAD, headers, SECRET, { now: NOW - 301 })).toBe(false)
  })

  test("honours toleranceSeconds", async () => {
    const headers = { "x-wi-signature-v2": await generateSignatureV2(PAYLOAD, SECRET, NOW) }
    expect(
      await verifyWebhook(PAYLOAD, headers, SECRET, { now: NOW + 60, toleranceSeconds: 30 }),
    ).toBe(false)
    expect(
      await verifyWebhook(PAYLOAD, headers, SECRET, { now: NOW + 60, toleranceSeconds: 120 }),
    ).toBe(true)
  })

  test("a tampered timestamp, body or secret fails", async () => {
    const sig = await generateSignatureV2(PAYLOAD, SECRET, NOW)
    const v1 = sig.split(",")[1]
    expect(
      await verifyWebhook(PAYLOAD, { "x-wi-signature-v2": `t=${NOW + 1},${v1}` }, SECRET, { now: NOW }),
    ).toBe(false)
    expect(
      await verifyWebhook(PAYLOAD.replace("Hello", "Hi"), { "x-wi-signature-v2": sig }, SECRET, { now: NOW }),
    ).toBe(false)
    expect(await verifyWebhook(PAYLOAD, { "x-wi-signature-v2": sig }, "wrong", { now: NOW })).toBe(false)
  })

  test("malformed v2 headers are rejected, never falling back to the legacy header", async () => {
    const legacy = await generateSignature(PAYLOAD, SECRET)
    for (const v2 of ["", "garbage", "t=abc,v1=00", `t=${NOW}`, `v1=00`]) {
      expect(
        await verifyWebhook(PAYLOAD, { "x-wi-signature-v2": v2, "x-wi-signature": legacy }, SECRET, { now: NOW }),
      ).toBe(false)
    }
  })

  test("no v2 header: falls back to the legacy x-wi-signature; nothing at all is rejected", async () => {
    const legacy = await generateSignature(PAYLOAD, SECRET)
    expect(await verifyWebhook(PAYLOAD, { "x-wi-signature": legacy }, SECRET)).toBe(true)
    expect(await verifyWebhook(PAYLOAD, {}, SECRET)).toBe(false)
  })

  test("accepts a Uint8Array body", async () => {
    const sig = await generateSignatureV2(PAYLOAD, SECRET, NOW)
    expect(
      await verifyWebhook(new TextEncoder().encode(PAYLOAD), { "x-wi-signature-v2": sig }, SECRET, { now: NOW }),
    ).toBe(true)
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

// ─── receipt ──────────────────────────────────────────────────────────────────

describe("receipt events", () => {
  // Same shapes the engine publishes and the docs show (engines/whatsmeow receiptPayload).
  const receipt = (data: Record<string, unknown>) =>
    JSON.stringify({
      event: "receipt",
      session_id: "sess-1",
      data: {
        chat: "5511998765432@s.whatsapp.net",
        sender: "5511998765432@s.whatsapp.net",
        timestamp: 1748790003,
        isFromMe: false,
        messageFromMe: true,
        ...data,
      },
      timestamp: "2026-06-01T15:00:03.000Z",
    })

  const cases: Array<[string, Record<string, unknown>]> = [
    ["delivered", { type: "", rawType: "", status: "delivered", messageIds: ["A", "B"] }],
    ["read", { type: "read", rawType: "read", status: "read", messageIds: ["A"] }],
    ["played", { type: "played", rawType: "played", status: "played", messageIds: ["C"] }],
    [
      "group (one receipt per participant)",
      {
        type: "read",
        rawType: "read",
        status: "read",
        chat: "120363025246125486@g.us",
        sender: "5511912345678@s.whatsapp.net",
        messageIds: ["G1"],
      },
    ],
  ]

  for (const [name, data] of cases) {
    test(`onReceipt gets the ${name} payload with messageIds[] and status`, async () => {
      let got: { event: string; data: { status?: string; messageIds: string[]; rawType: string } } | undefined
      const handler = createWebhookHandler({
        secret: SECRET,
        onReceipt: (e) => {
          got = e as unknown as typeof got
        },
      })
      const body = receipt(data)
      const res = await handler(await makeRequest(body, await generateSignature(body, SECRET)))
      expect(res.status).toBe(204)
      expect(got?.event).toBe("receipt")
      expect(got?.data.status).toBe(data.status as string)
      expect(got?.data.rawType).toBe(data.rawType as string)
      expect(got?.data.messageIds).toEqual(data.messageIds as string[])
    })
  }
})

describe("createWebhookHandler replay protection", () => {
  test("a v2-signed delivery is accepted; a stale one is rejected 401; toleranceSeconds is configurable", async () => {
    const now = Math.floor(Date.now() / 1000)
    const mk = async (t: number) =>
      new Request("https://example.com/webhook", {
        method: "POST",
        headers: { "x-wi-signature-v2": await generateSignatureV2(PAYLOAD, SECRET, t) },
        body: PAYLOAD,
      })
    const handler = createWebhookHandler({ secret: SECRET })
    expect((await handler(await mk(now))).status).toBe(204)
    expect((await handler(await mk(now - 3600))).status).toBe(401)
    const lenient = createWebhookHandler({ secret: SECRET, toleranceSeconds: 7200 })
    expect((await lenient(await mk(now - 3600))).status).toBe(204)
  })
})

// ─── disconnected ─────────────────────────────────────────────────────────────

describe("disconnected events", () => {
  const disconnected = (data: Record<string, unknown>) =>
    JSON.stringify({ event: "disconnected", session_id: "sess-1", data, timestamp: "t" })

  const cases: Array<[string, Record<string, unknown>]> = [
    ["transient", { reason: "transient", willReconnect: true }],
    ["logged_out", { reason: "logged_out", willReconnect: false, resume: "connect", code: 401, detail: "401: logged out" }],
    ["temporary_ban", { reason: "temporary_ban", willReconnect: false, resume: "connect", code: 101, expireSeconds: 3600, retryAfterSeconds: 3600 }],
    ["paused", { reason: "paused", willReconnect: false, resume: "resume" }],
    ["a reason a newer engine adds", { reason: "brand_new", willReconnect: true }],
  ]

  for (const [name, data] of cases) {
    test(`onDisconnected gets willReconnect with ${name}`, async () => {
      let got: DisconnectedData | undefined
      const handler = createWebhookHandler({
        secret: SECRET,
        onDisconnected: (e) => {
          got = e.data
        },
      })
      const body = disconnected(data)
      const res = await handler(await makeRequest(body, await generateSignature(body, SECRET)))
      expect(res.status).toBe(204)
      expect(got?.reason).toBe(data.reason as string)
      expect(got?.willReconnect).toBe(data.willReconnect as boolean)
      expect(got?.resume).toBe(data.resume as DisconnectedData["resume"])
    })
  }

  test("narrowing on the closed reasons is exhaustive, an unknown one falls to willReconnect", () => {
    const decide = (d: DisconnectedData): string => {
      switch (d.reason) {
        case "transient":
        case "manual":
        case "paused":
        case "logged_out":
        case "replaced":
        case "temporary_ban":
        case "client_outdated":
        case "connect_failure":
          return d.willReconnect ? "wait" : "act"
        default:
          return d.willReconnect ? "wait" : "act"
      }
    }
    expect(decide({ reason: "brand_new", willReconnect: true })).toBe("wait")
    expect(decide({ reason: "replaced", willReconnect: false })).toBe("act")
    expect(DISCONNECT_REASONS).toHaveLength(8)
  })
})

// ─── pairing ──────────────────────────────────────────────────────────────────

describe("pairing events", () => {
  const pairing = (event: string, data: Record<string, unknown>) =>
    JSON.stringify({ event, session_id: "sess-1", data, timestamp: "t" })

  const cases: Array<[string, PairingFailedData]> = [
    ["an unread QR", { method: "qr", reason: "timeout", at: "2026-11-13T12:02:40Z" }],
    ["a code that expired", { method: "code", reason: "timeout", at: "2026-11-13T12:02:40Z" }],
    ["a refused link", { method: "qr", reason: "rejected", at: "2026-11-13T12:02:40Z" }],
    ["a cancelled attempt", { method: "qr", reason: "cancelled", at: "2026-11-13T12:02:40Z" }],
    ["a reason a newer engine adds", { method: "qr", reason: "brand_new", at: "2026-11-13T12:02:40Z" }],
  ]

  for (const [name, data] of cases) {
    test(`onPairingFailed gets method, reason and at with ${name}`, async () => {
      let got: PairingFailedData | undefined
      const handler = createWebhookHandler({
        secret: SECRET,
        onPairingFailed: (e) => {
          got = e.data
        },
      })
      const body = pairing("pairing.failed", { ...data })
      const res = await handler(await makeRequest(body, await generateSignature(body, SECRET)))
      expect(res.status).toBe(204)
      expect(got).toEqual(data)
    })
  }

  test("onPairingSucceeded gets method and at, and does not fire onPairingFailed", async () => {
    let succeeded: PairingSucceededData | undefined
    let failed = false
    const handler = createWebhookHandler({
      secret: SECRET,
      onPairingSucceeded: (e) => {
        succeeded = e.data
      },
      onPairingFailed: () => {
        failed = true
      },
    })
    const body = pairing("pairing.succeeded", { method: "code", at: "2026-11-13T12:02:40Z" })
    const res = await handler(await makeRequest(body, await generateSignature(body, SECRET)))
    expect(res.status).toBe(204)
    expect(succeeded).toEqual({ method: "code", at: "2026-11-13T12:02:40Z" })
    expect(failed).toBe(false)
  })

  test("the reasons are the closed set, and an unknown one falls to the default branch", () => {
    expect([...PAIRING_FAILURE_REASONS]).toEqual(["timeout", "rejected", "cancelled", "client_outdated", "error"])
    const advice = (d: PairingFailedData): string => {
      switch (d.reason) {
        case "timeout":
          return "generate another QR"
        case "rejected":
        case "cancelled":
        case "client_outdated":
        case "error":
          return "see the docs"
        default:
          return "treat as error"
      }
    }
    expect(advice({ method: "qr", reason: "timeout", at: "t" })).toBe("generate another QR")
    expect(advice({ method: "qr", reason: "brand_new", at: "t" })).toBe("treat as error")
  })

  test("KnownWebhookEvent carries both pairing payloads, typed", () => {
    const failed: KnownWebhookEvent = {
      event: "pairing.failed",
      session_id: "sess-1",
      data: { method: "qr", reason: "timeout", at: "t" },
      timestamp: "t",
    }
    const succeeded: KnownWebhookEvent = {
      event: "pairing.succeeded",
      session_id: "sess-1",
      data: { method: "code", at: "t" },
      timestamp: "t",
    }
    expect([failed.event, succeeded.event]).toEqual(["pairing.failed", "pairing.succeeded"])
  })
})

// ─── session_metadata ─────────────────────────────────────────────────────────

describe("session_metadata", () => {
  test("parseWebhookEvent keeps the labels of the session, typed", () => {
    const event = parseWebhookEvent(
      JSON.stringify({
        event: "connected",
        session_id: "sess-1",
        session_metadata: { purpose: "briefing" },
        data: { phone: "5511999999999" },
        timestamp: "t",
      }),
    )
    const purpose: string | undefined = event.session_metadata?.purpose
    expect(purpose).toBe("briefing")
  })

  test("an event from a server that does not send it has no session_metadata", () => {
    expect(parseWebhookEvent(PAYLOAD).session_metadata).toBeUndefined()
  })

  test("the handler passes the labels to the typed callbacks", async () => {
    let seen: unknown
    const handler = createWebhookHandler({
      secret: SECRET,
      onConnected: (event) => {
        seen = event.session_metadata
      },
    })
    const body = JSON.stringify({
      event: "connected",
      session_id: "sess-1",
      session_metadata: { purpose: "clientes" },
      data: { phone: "5511999999999" },
      timestamp: "t",
    })
    const res = await handler(await makeRequest(body, await generateSignature(body, SECRET)))
    expect(res.status).toBe(204)
    expect(seen).toEqual({ purpose: "clientes" })
  })
})
