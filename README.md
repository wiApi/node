# wi-api Node.js SDK

[![npm](https://img.shields.io/npm/v/wi-api?style=flat-square)](https://www.npmjs.com/package/wi-api)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/wi-api?style=flat-square)](https://bundlephobia.com/package/wi-api)
[![license](https://img.shields.io/npm/l/wi-api?style=flat-square)](LICENSE)

Node.js and TypeScript SDK for [wi-api](https://wi.api.br). Send and receive WhatsApp messages in a few lines of code.

Works on Node 18+, Bun, Deno, and Cloudflare Workers. No runtime dependencies.

## Install

```bash
npm install wi-api
```

```bash
bun add wi-api
```

```bash
pnpm add wi-api
```

## Quick start

```typescript
import { Wi } from "wi-api"

const wi = new Wi({ apiKey: process.env.WI_API_KEY! })

const msg = await wi.session("my-instance").sendText({
  to: "5511999999999",
  text: "Hello from wi-api",
})

console.log(msg.messageId)
```

## Sessions

```typescript
const session = wi.session("my-instance")

// Start the connection flow
await session.connect()

// Poll for QR code (base64 PNG)
const { qr } = await session.qr()

// Or pair by phone number
const { pairCode } = await session.pairPhone("5511999999999")

// Check status
const { connected, phone } = await session.status()

await session.disconnect() // keeps session keys
await session.logout()     // removes session keys
```

## Sending messages

```typescript
// Text
await session.sendText({ to: "5511999999999", text: "Hello!" })

// Reply
await session.sendText({ to: "5511999999999", text: "Got it", quoted: messageId })

// Image
await session.sendImage({ to: "5511999999999", url: "https://example.com/photo.jpg", caption: "Look" })

// Voice note
await session.sendAudio({ to: "5511999999999", url: "https://example.com/audio.ogg", ptt: true })

// Document
await session.sendDocument({ to: "5511999999999", url: "https://example.com/file.pdf", filename: "report.pdf" })

// Location
await session.sendLocation({ to: "5511999999999", latitude: -23.5505, longitude: -46.6333 })

// Poll
await session.sendPoll({ to: "5511999999999", question: "Best stack?", options: ["Bun", "Node", "Deno"] })

// Reaction
await session.react({ to: "5511999999999", messageId, emoji: "" })
```

## Webhooks

wi-api signs every webhook with `x-wi-signature-v2: t=<unix seconds>,v1=<hex>` (HMAC-SHA256 of `<t>.<rawBody>`) and also sends `x-wi-delivery-id`, `x-wi-timestamp` and `x-wi-attempt`. `createWebhookHandler` rejects deliveries older than 5 minutes (`toleranceSeconds`). The legacy body-only `x-wi-signature: sha256=<hex>` is still sent.

```typescript
import { createWebhookHandler } from "wi-api"

// Next.js App Router
export const POST = createWebhookHandler({
  secret: process.env.WI_WEBHOOK_SECRET!,
  async onMessage({ data }) {
    console.log(data.from, data.text)
  },
  async onConnected({ data }) {
    console.log("connected:", data.phone)
  },
})
```

```typescript
// Hono / Elysia / any Web API runtime
const handler = createWebhookHandler({ secret: "...", onMessage: ... })
app.post("/webhook", (c) => handler(c.req.raw))
```

Verify manually:

```typescript
import { verifyWebhook, parseWebhookEvent } from "wi-api"

const valid = await verifyWebhook(rawBody, req.headers, secret, { toleranceSeconds: 300 })
if (!valid) return new Response(null, { status: 401 })

const event = parseWebhookEvent(rawBody)
```

`receipt` events carry `status` (`"delivered" | "read" | "played"`), `rawType` and `messageIds[]`; use `onReceipt`.

## Error handling

```typescript
import { WiError } from "wi-api"

try {
  await session.sendText({ to: "5511999999999", text: "Hello" })
} catch (err) {
  if (err instanceof WiError) {
    console.error(err.status, err.message)
  }
}
```

## Configuration

```typescript
const wi = new Wi({
  apiKey:  process.env.WI_API_KEY!,
  baseUrl: "https://endpoint.wi.api.br", // default
  timeout: 30_000,                        // ms, default 30s
})
```

## Resources

- [npm](https://www.npmjs.com/package/wi-api)
- [Dashboard](https://wi.api.br)
- [Docs](https://docs.wi.api.br)
- [Changelog](https://github.com/wiApi/node/releases)
