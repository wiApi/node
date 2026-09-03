/**
 * Generates a real HMAC-SHA256 x-wi-signature header for use in webhook tests.
 * This ensures tests exercise the actual verification logic against genuine signatures.
 */
export async function generateSignature(
  body: string,
  secret: string,
): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body).buffer as ArrayBuffer)
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return `sha256=${hex}`
}
