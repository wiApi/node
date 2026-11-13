import { describe, test, expect } from "bun:test"
import { WiError } from "../src/error.ts"

describe("WiError", () => {
  test("has correct name", () => {
    const err = new WiError("oops", 400)
    expect(err.name).toBe("WiError")
  })

  test("is instanceof Error", () => {
    expect(new WiError("bad", 400)).toBeInstanceOf(Error)
  })

  test("is instanceof WiError", () => {
    expect(new WiError("bad", 400)).toBeInstanceOf(WiError)
  })

  test("stores status", () => {
    expect(new WiError("bad", 429).status).toBe(429)
  })

  test("stores optional code", () => {
    expect(new WiError("bad", 400, "INVALID_PARAM").code).toBe("INVALID_PARAM")
  })

  test("code is undefined when not provided", () => {
    expect(new WiError("bad", 400).code).toBeUndefined()
  })

  test("message is accessible", () => {
    expect(new WiError("Not found", 404).message).toBe("Not found")
  })
})

describe("WiError.fromResponse", () => {
  test("extracts message from JSON body", async () => {
    const res = new Response(JSON.stringify({ message: "Bad input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
    const err = await WiError.fromResponse(res)
    expect(err.message).toBe("Bad input")
    expect(err.status).toBe(400)
  })

  test("extracts error field when message missing", async () => {
    const res = new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })
    const err = await WiError.fromResponse(res)
    expect(err.message).toBe("Not found")
  })

  test("extracts code from JSON body", async () => {
    const res = new Response(JSON.stringify({ message: "Rate limited", code: "RATE_LIMIT" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    })
    const err = await WiError.fromResponse(res)
    expect(err.code).toBe("RATE_LIMIT")
  })

  test("falls back to HTTP status text on non-JSON body", async () => {
    const res = new Response("Internal Server Error", { status: 500 })
    const err = await WiError.fromResponse(res)
    expect(err.status).toBe(500)
    expect(err.message).toContain("500")
  })

  test("handles empty body gracefully", async () => {
    const res = new Response(null, { status: 503 })
    const err = await WiError.fromResponse(res)
    expect(err.status).toBe(503)
  })
})

describe("WiError.fromResponse nested shape", () => {
  test("reads { error: { code, message } }", async () => {
    const res = new Response(
      JSON.stringify({ error: { code: "key_forbidden", message: "read-only", requiredScope: "messages:send" } }),
      { status: 403, headers: { "content-type": "application/json" } },
    )
    const err = await WiError.fromResponse(res)
    expect(err.message).toBe("read-only")
    expect(err.code).toBe("key_forbidden")
    expect(err.status).toBe(403)
  })
})
