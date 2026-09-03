# wi-api — Node.js SDK

[![npm](https://img.shields.io/npm/v/wi-api?style=flat-square&color=0d9373)](https://www.npmjs.com/package/wi-api)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/wi-api?style=flat-square&color=0d9373)](https://bundlephobia.com/package/wi-api)
[![license](https://img.shields.io/npm/l/wi-api?style=flat-square&color=0d9373)](LICENSE)

Official Node.js / TypeScript SDK for the [wi-api](https://wi.api.br) WhatsApp platform.

- Zero runtime dependencies — native `fetch`, native `crypto`
- TypeScript-first with full generics
- ESM + CJS dual package
- Works on Node 18+, Bun, Deno, Cloudflare Workers, and any Web API runtime

---

## Install

```bash
npm install wi-api
# or
bun add wi-api
# or
pnpm add wi-api
```

---

## Quick start

```typescript
import { Wi } from "wi-api"

const wi = new Wi({ apiKey: process.env.WI_API_KEY! })
const session = wi.session("my-instance")

const msg = await session.sendText({
  to: "5511999999999",
  text: "Hello from wi-api",
})

console.log(msg.messageId)
```

---

## Sessions

```typescript
// Connect and watch for QR
await session.connect()

// Poll for QR code
const { qr } = await session.qr()
// qr is a base64 PNG — render it or print to terminal

// Or pair by phone number (no QR scanning needed)
const { pairCode } = await session.pairPhone("5511999999999")
// Show pairCode to the user — they enter it on WhatsApp mobile

// Check status
const { connected, phone } = await session.status()

// Disconnect (keeps session keys)
await session.disconnect()

// Logout (deletes session keys — must re-pair)
await session.logout()
```

---

## Sending messages

```typescript
// Text
await session.sendText({ to: "5511999999999", text: "Hello!" })

// Quote a message
await session.sendText({
  to: "5511999999999",
  text: "Agreed",
  quoted: "MESSAGE_ID",
})

// Image
await session.sendImage({
  to: "5511999999999",
  url: "https://example.com/photo.jpg",
  caption: "Check this out",
})

// Voice note
await session.sendAudio({
  to: "5511999999999",
  url: "https://example.com/audio.ogg",
  ptt: true,
})

// Video
await session.sendVideo({
  to: "5511999999999",
  url: "https://example.com/clip.mp4",
})

// Document
await session.sendDocument({
  to: "5511999999999",
  url: "https://example.com/report.pdf",
  filename: "Q3-report.pdf",
})

// Location
await session.sendLocation({
  to: "5511999999999",
  latitude: -23.5505,
  longitude: -46.6333,
  title: "São Paulo",
})

// Reaction
await session.react({
  to: "5511999999999",
  messageId: "MESSAGE_ID",
  emoji: "👍",
})

// Poll
await session.sendPoll({
  to: "5511999999999",
  question: "Best stack?",
  options: ["Bun + Elysia", "Node + Fastify", "Go + Fiber"],
})
```

---

## Webhooks

wi-api sends events to your endpoint signed with `x-wi-signature: sha256=<hex>`.

### Next.js App Router

```typescript
// app/api/webhook/route.ts
import { createWebhookHandler } from "wi-api"

export const POST = createWebhookHandler({
  secret: process.env.WI_WEBHOOK_SECRET!,
  async onMessage({ data }) {
    console.log(`[${data.chat}] ${data.from}: ${data.text}`)
  },
  async onConnected({ data }) {
    console.log("connected:", data.phone)
  },
})
```

### Hono / Elysia / any Web API runtime

```typescript
import { createWebhookHandler } from "wi-api"

const handler = createWebhookHandler({
  secret: process.env.WI_WEBHOOK_SECRET!,
  async onMessage({ session_id, data }) {
    await db.messages.insert({ sessionId: session_id, ...data })
  },
})

// Hono
app.post("/webhook", (c) => handler(c.req.raw))
```

### Verify manually

```typescript
import { verifyWebhookSignature, parseWebhookEvent } from "wi-api"

const valid = await verifyWebhookSignature(rawBody, req.headers["x-wi-signature"], secret)
if (!valid) return new Response(null, { status: 401 })

const event = parseWebhookEvent(rawBody)
```

---

## Error handling

```typescript
import { Wi, WiError } from "wi-api"

try {
  await session.sendText({ to: "5511999999999", text: "Hello" })
} catch (err) {
  if (err instanceof WiError) {
    console.error(err.status, err.message, err.code)
  }
}
```

---

## Configuration

```typescript
const wi = new Wi({
  apiKey: "...",
  baseUrl: "https://endpoint.wi.api.br", // default
  timeout: 30_000,                        // ms, default 30s
})
```

---

## License

MIT — [wi.api.br](https://wi.api.br)
