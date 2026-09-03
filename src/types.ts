// ─── Auth & Config ────────────────────────────────────────────────────────────

export interface WiConfig {
  /** API key from wi.api.br dashboard */
  apiKey: string
  /** Override base URL. Default: https://endpoint.wi.api.br */
  baseUrl?: string
  /** Request timeout in milliseconds. Default: 30_000 */
  timeout?: number
  /**
   * Custom fetch implementation. Defaults to globalThis.fetch.
   * Inject a mock in tests to intercept outgoing requests.
   */
  fetch?: typeof globalThis.fetch
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface SessionStatus {
  connected: boolean
  phone?: string
}

export interface QRCode {
  qr?: string
}

export interface PairPhoneResult {
  pairCode?: string
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface MessageResponse {
  messageId: string
  id: string
}

export interface SendTextParams {
  /** Phone number or JID (e.g. "5511999999999" or "5511999999999@s.whatsapp.net") */
  to: string
  text: string
  /** Message ID to quote */
  quoted?: string
  mentions?: string[]
}

export interface SendImageParams {
  to: string
  /** Publicly accessible URL or base64 data URI */
  url: string
  caption?: string
  quoted?: string
}

export interface SendAudioParams {
  to: string
  url: string
  /** Send as voice note (push-to-talk). Default: false */
  ptt?: boolean
}

export interface SendVideoParams {
  to: string
  url: string
  caption?: string
  quoted?: string
}

export interface SendDocumentParams {
  to: string
  url: string
  filename?: string
  caption?: string
}

export interface SendLocationParams {
  to: string
  latitude: number
  longitude: number
  title?: string
  address?: string
}

export interface SendContactParams {
  to: string
  contactName: string
  contactNumber: string
}

export interface SendStickerParams {
  to: string
  url: string
}

export interface SendPollParams {
  to: string
  question: string
  options: string[]
  multipleAnswers?: boolean
}

export interface SendReactionParams {
  to: string
  messageId: string
  /** Emoji or empty string to remove reaction */
  emoji: string
}

export interface SendLinkParams {
  to: string
  url: string
  title?: string
  description?: string
  thumbnail?: string
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface MarkReadParams {
  chatId: string
  lastMessageId?: string
}

export interface PresenceParams {
  chatId: string
  /** "composing" | "recording" | "paused" */
  presence: "composing" | "recording" | "paused"
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export type WebhookEventType =
  | "message"
  | "message.sent"
  | "message.deleted"
  | "message.reaction"
  | "connected"
  | "disconnected"
  | "qr"
  | "call.incoming"
  | "call.accepted"
  | "call.rejected"

export interface WebhookEvent<T = unknown> {
  event: WebhookEventType
  session_id: string
  data: T
  timestamp: string
}

export interface IncomingMessage {
  id: string
  chat: string
  from: string
  fromMe: boolean
  type:
    | "text"
    | "image"
    | "audio"
    | "video"
    | "document"
    | "sticker"
    | "ptt"
    | "location"
    | "contact"
    | "reaction"
    | "poll"
    | "unknown"
  text?: string
  caption?: string
  mediaUrl?: string
  mimetype?: string
  filename?: string
  latitude?: number
  longitude?: number
  timestamp: number
  quoted?: {
    id: string
    from: string
    text?: string
  }
}

export interface WebhookHandlerOptions {
  /** Webhook secret for signature verification */
  secret: string
  onMessage?: (event: WebhookEvent<IncomingMessage>) => void | Promise<void>
  onMessageSent?: (event: WebhookEvent<IncomingMessage>) => void | Promise<void>
  onConnected?: (event: WebhookEvent<{ phone: string }>) => void | Promise<void>
  onDisconnected?: (event: WebhookEvent<Record<string, never>>) => void | Promise<void>
  onQR?: (event: WebhookEvent<{ qr: string }>) => void | Promise<void>
  /** Catch-all handler for any event type */
  onEvent?: (event: WebhookEvent) => void | Promise<void>
}
