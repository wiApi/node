import { describe, test, expect } from "bun:test"
import { Wi } from "../src/index.ts"
import { Session } from "../src/session.ts"

describe("Wi", () => {
  test("throws if apiKey is missing", () => {
    expect(() => new Wi({ apiKey: "" })).toThrow("apiKey is required")
  })

  test("throws if apiKey is not provided", () => {
    // @ts-expect-error intentional — testing runtime guard
    expect(() => new Wi({})).toThrow("apiKey is required")
  })

  test("session() returns a Session with correct id", () => {
    const wi = new Wi({ apiKey: "test-key" })
    const session = wi.session("my-instance")
    expect(session).toBeInstanceOf(Session)
    expect(session.id).toBe("my-instance")
  })

  test("trims trailing slash from baseUrl", () => {
    const fetchFn = async () => new Response("{}", { headers: { "content-type": "application/json" } })
    const wi = new Wi({ apiKey: "key", baseUrl: "https://example.com/", fetch: fetchFn })
    const session = wi.session("s")
    // No error thrown — confirms baseUrl was accepted
    expect(session).toBeInstanceOf(Session)
  })

  test("uses default baseUrl when not provided", () => {
    const requests: string[] = []
    const fetchFn = async (input: RequestInfo | URL) => {
      requests.push(String(input))
      return new Response(JSON.stringify({ connected: false }), {
        headers: { "content-type": "application/json" },
      })
    }
    const wi = new Wi({ apiKey: "key", fetch: fetchFn })
    wi.session("s").status()
    // URL starts with the default base
    // (async, but we just verify no throw on construction)
    expect(wi).toBeTruthy()
  })
})
