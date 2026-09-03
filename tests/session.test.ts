import { describe, test, expect } from "bun:test"
import { Wi } from "../src/index.ts"
import { WiError } from "../src/error.ts"
import { mockFetch, hangingFetch, networkErrorFetch } from "./helpers/mockFetch.ts"

const BASE = "https://test.wi.api.br"
const KEY = "test-api-key-123"

function client(overrides?: { status?: number; body?: unknown }) {
  const { fetch, requests } = mockFetch(overrides ?? { body: { messageId: "msg_1", id: "msg_1" } })
  const wi = new Wi({ apiKey: KEY, baseUrl: BASE, fetch })
  return { session: wi.session("sess-1"), requests }
}

// ─── sendText ─────────────────────────────────────────────────────────────────

describe("Session.sendText", () => {
  test("sends POST to /sessions/:id/messages/send-text", async () => {
    const { session, requests } = client()
    await session.sendText({ to: "5511999999999", text: "Hello!" })

    expect(requests).toHaveLength(1)
    expect(requests[0]!.method).toBe("POST")
    expect(requests[0]!.url).toBe(`${BASE}/sessions/sess-1/messages/send-text`)
  })

  test("sends x-api-key header", async () => {
    const { session, requests } = client()
    await session.sendText({ to: "5511999999999", text: "Hi" })
    expect(requests[0]!.headers["x-api-key"]).toBe(KEY)
  })

  test("sends correct body", async () => {
    const { session, requests } = client()
    await session.sendText({ to: "5511999999999", text: "Hello!", quoted: "prev_id" })
    expect(requests[0]!.body).toEqual({ to: "5511999999999", text: "Hello!", quoted: "prev_id" })
  })

  test("returns messageId from response", async () => {
    const { session } = client({ body: { messageId: "msg_abc", id: "msg_abc" } })
    const result = await session.sendText({ to: "5511999999999", text: "Hi" })
    expect(result.messageId).toBe("msg_abc")
  })

  test("throws WiError on 401", async () => {
    const { session } = client({ status: 401, body: { message: "Unauthorized" } })
    await expect(session.sendText({ to: "5511999999999", text: "Hi" })).rejects.toBeInstanceOf(WiError)
  })

  test("throws WiError on 429 with correct status", async () => {
    const { session } = client({ status: 429, body: { message: "Rate limit" } })
    try {
      await session.sendText({ to: "5511999999999", text: "Hi" })
      throw new Error("expected throw")
    } catch (err) {
      expect(err).toBeInstanceOf(WiError)
      if (err instanceof WiError) expect(err.status).toBe(429)
    }
  })

  test("throws WiError on 500", async () => {
    const { session } = client({ status: 500, body: { message: "Server error" } })
    await expect(session.sendText({ to: "5511999999999", text: "Hi" })).rejects.toBeInstanceOf(WiError)
  })
})

// ─── sendImage ────────────────────────────────────────────────────────────────

describe("Session.sendImage", () => {
  test("sends POST to /sessions/:id/messages/send-image with correct body", async () => {
    const { session, requests } = client()
    await session.sendImage({ to: "5511999999999", url: "https://img.com/a.jpg", caption: "hey" })
    expect(requests[0]!.url).toContain("/messages/send-image")
    expect(requests[0]!.body).toMatchObject({ to: "5511999999999", url: "https://img.com/a.jpg", caption: "hey" })
  })
})

// ─── sendAudio ────────────────────────────────────────────────────────────────

describe("Session.sendAudio", () => {
  test("sends ptt flag when true", async () => {
    const { session, requests } = client()
    await session.sendAudio({ to: "5511999999999", url: "https://cdn/audio.ogg", ptt: true })
    expect(requests[0]!.body).toMatchObject({ ptt: true })
  })

  test("omits ptt when false", async () => {
    const { session, requests } = client()
    await session.sendAudio({ to: "5511999999999", url: "https://cdn/audio.ogg" })
    const body = requests[0]!.body as Record<string, unknown>
    expect(body.ptt).toBeUndefined()
  })
})

// ─── sendDocument ─────────────────────────────────────────────────────────────

describe("Session.sendDocument", () => {
  test("sends filename and caption", async () => {
    const { session, requests } = client()
    await session.sendDocument({ to: "5511999999999", url: "https://cdn/doc.pdf", filename: "report.pdf", caption: "Q3" })
    expect(requests[0]!.body).toMatchObject({ filename: "report.pdf", caption: "Q3" })
  })
})

// ─── sendLocation ─────────────────────────────────────────────────────────────

describe("Session.sendLocation", () => {
  test("sends lat/lng and title", async () => {
    const { session, requests } = client()
    await session.sendLocation({ to: "5511999999999", latitude: -23.5505, longitude: -46.6333, title: "SP" })
    expect(requests[0]!.body).toMatchObject({ latitude: -23.5505, longitude: -46.6333, title: "SP" })
  })
})

// ─── sendPoll ─────────────────────────────────────────────────────────────────

describe("Session.sendPoll", () => {
  test("sends question and options array", async () => {
    const { session, requests } = client()
    await session.sendPoll({ to: "5511999999999", question: "Best?", options: ["A", "B", "C"] })
    expect(requests[0]!.body).toMatchObject({ question: "Best?", options: ["A", "B", "C"] })
  })
})

// ─── react ────────────────────────────────────────────────────────────────────

describe("Session.react", () => {
  test("sends to /chat/react with messageId and emoji", async () => {
    const { fetch, requests } = mockFetch({ status: 204, body: null })
    const wi = new Wi({ apiKey: KEY, baseUrl: BASE, fetch })
    await wi.session("s").react({ to: "5511999999999", messageId: "msg_1", emoji: "👍" })
    expect(requests[0]!.url).toContain("/chat/react")
    expect(requests[0]!.body).toMatchObject({ messageId: "msg_1", emoji: "👍" })
  })
})

// ─── markRead / presence ──────────────────────────────────────────────────────

describe("Session.markRead", () => {
  test("sends POST to /chat/markread", async () => {
    const { fetch, requests } = mockFetch({ status: 204, body: null })
    const wi = new Wi({ apiKey: KEY, baseUrl: BASE, fetch })
    await wi.session("s").markRead({ chatId: "5511999999999@s.whatsapp.net" })
    expect(requests[0]!.url).toContain("/chat/markread")
    expect(requests[0]!.body).toMatchObject({ chatId: "5511999999999@s.whatsapp.net" })
  })
})

describe("Session.presence", () => {
  test("sends composing state", async () => {
    const { fetch, requests } = mockFetch({ status: 204, body: null })
    const wi = new Wi({ apiKey: KEY, baseUrl: BASE, fetch })
    await wi.session("s").presence({ chatId: "5511@s.whatsapp.net", presence: "composing" })
    expect(requests[0]!.body).toMatchObject({ presence: "composing" })
  })
})

// ─── Session lifecycle ────────────────────────────────────────────────────────

describe("Session.status", () => {
  test("sends GET to /sessions/:id/status", async () => {
    const { fetch, requests } = mockFetch({ body: { connected: true, phone: "5511999" } })
    const wi = new Wi({ apiKey: KEY, baseUrl: BASE, fetch })
    const result = await wi.session("abc").status()
    expect(requests[0]!.method).toBe("GET")
    expect(requests[0]!.url).toBe(`${BASE}/sessions/abc/status`)
    expect(result.connected).toBe(true)
    expect(result.phone).toBe("5511999")
  })
})

describe("Session.qr", () => {
  test("sends GET and returns qr field", async () => {
    const { fetch, requests } = mockFetch({ body: { qr: "data:image/png;base64,abc" } })
    const wi = new Wi({ apiKey: KEY, baseUrl: BASE, fetch })
    const result = await wi.session("s").qr()
    expect(requests[0]!.method).toBe("GET")
    expect(result.qr).toBe("data:image/png;base64,abc")
  })
})

describe("Session.connect", () => {
  test("sends POST to /sessions/:id/connect", async () => {
    const { fetch, requests } = mockFetch({ status: 200, body: {} })
    const wi = new Wi({ apiKey: KEY, baseUrl: BASE, fetch })
    await wi.session("s").connect()
    expect(requests[0]!.method).toBe("POST")
    expect(requests[0]!.url).toContain("/connect")
  })
})

describe("Session.pairPhone", () => {
  test("sends phone in body", async () => {
    const { fetch, requests } = mockFetch({ body: { pairCode: "ABCD1234" } })
    const wi = new Wi({ apiKey: KEY, baseUrl: BASE, fetch })
    const result = await wi.session("s").pairPhone("5511999999999")
    expect(requests[0]!.body).toEqual({ phone: "5511999999999" })
    expect(result.pairCode).toBe("ABCD1234")
  })
})

// ─── Network errors ───────────────────────────────────────────────────────────

describe("network failures", () => {
  test("propagates network error from fetch", async () => {
    const wi = new Wi({ apiKey: KEY, baseUrl: BASE, fetch: networkErrorFetch })
    await expect(wi.session("s").sendText({ to: "5511", text: "hi" })).rejects.toThrow()
  })

  test("aborts on timeout", async () => {
    const wi = new Wi({ apiKey: KEY, baseUrl: BASE, timeout: 10, fetch: hangingFetch })
    await expect(wi.session("s").sendText({ to: "5511", text: "hi" })).rejects.toThrow()
  })
})
