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
  | "receipt"
  | "message.deleted"
  | "message.reaction"
  | "connected"
  | "disconnected"
  | "qr"
  | "pairing.failed"
  | "pairing.succeeded"
  | "call.incoming"
  | "call.accepted"
  | "call.rejected"

/** Request headers of a webhook delivery: a `Headers` or a plain (Node) header object. */
export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>

/**
 * Normalized delivery state of a `receipt`. Absent on receipt types that say
 * nothing about delivery (`retry`, `server-error`, `inactive`, `peer_msg`, `hist_sync`).
 */
export type ReceiptStatus = "delivered" | "read" | "played"

/**
 * Payload of the `receipt` event. One receipt can acknowledge several messages
 * (`messageIds`); in groups there is one receipt per participant.
 */
export interface ReceiptData {
  status?: ReceiptStatus
  /** Raw WhatsApp receipt type: "" (delivered), "sender", "read", "read-self", "played", "played-self", "retry", ... `type` carries the same value. */
  rawType: string
  type: string
  chat: string
  /** Who produced the receipt: the contact, or a group participant. */
  sender: string
  messageIds: string[]
  /** Unix seconds. */
  timestamp: number
  /** The receipt came from another device of your own account (`*-self`, `sender`). */
  isFromMe: boolean
  /** The acknowledged messages were sent by you: only these update the status of sent messages. */
  messageFromMe: boolean
  /** Author of the acknowledged messages when it is not you (group reads). */
  messageSender?: string
}

/**
 * Why a session went offline: the closed set the `disconnected` webhook uses.
 * `willReconnect` says what the engine does next; `resume` names the call that
 * brings the session back when it will not come back by itself.
 */
export const DISCONNECT_REASONS = [
  "transient",
  "manual",
  "paused",
  "logged_out",
  "replaced",
  "temporary_ban",
  "client_outdated",
  "connect_failure",
] as const

export type DisconnectReason = (typeof DISCONNECT_REASONS)[number]

/**
 * Payload of the `disconnected` event. `willReconnect` is always present: when
 * `reason` is not one you know (a newer server can add values), decide by it.
 * `reason` stays open (`string & {}`) so a new value never breaks decoding or
 * a `switch` with a `default` branch.
 */
export interface DisconnectedData {
  reason: DisconnectReason | (string & {})
  /** `true`: the engine reconnects by itself. `false`: offline until you act. */
  willReconnect: boolean
  /** Call that brings the session back: `connect` or `resume`. Only with `willReconnect: false`. */
  resume?: "connect" | "resume" | (string & {})
  /** Code from WhatsApp (`logged_out`, `temporary_ban`, `connect_failure`). */
  code?: number
  /** Diagnostic text; do not branch on it. `"local"` marks a logout you asked for. */
  detail?: string
  /** `temporary_ban`: length of the ban, in seconds. */
  expireSeconds?: number
  /** `temporary_ban`: seconds until the engine reconnects by itself. */
  retryAfterSeconds?: number
}

/** How a pairing attempt links the device: `qr` (scan) or `code` (pairing code by phone number). */
export type PairingMethod = "qr" | "code"

/**
 * Why a pairing attempt ended without linking the number: the closed set the
 * `pairing.failed` webhook uses.
 *
 * - `timeout`: nobody read the QR or typed the code in time (the QR channel lasts about 160 s)
 * - `rejected`: WhatsApp refused the link
 * - `cancelled`: `disconnect` or `pause` ended the attempt
 * - `client_outdated`: WhatsApp refuses the connector's version
 * - `error`: any other failure
 */
export const PAIRING_FAILURE_REASONS = [
  "timeout",
  "rejected",
  "cancelled",
  "client_outdated",
  "error",
] as const

export type PairingFailedReason = (typeof PAIRING_FAILURE_REASONS)[number]

/**
 * Payload of the `pairing.failed` event. `reason` stays open (`string & {}`) so
 * a value a newer server adds never breaks decoding: treat an unknown one like
 * `error`.
 */
export interface PairingFailedData {
  method: PairingMethod | (string & {})
  reason: PairingFailedReason | (string & {})
  /** End of the attempt, ISO 8601. */
  at: string
}

/** Payload of the `pairing.succeeded` event, sent just before `connected`. */
export interface PairingSucceededData {
  method: PairingMethod | (string & {})
  /** End of the attempt, ISO 8601. */
  at: string
}

/**
 * Labels set on the session with `metadata` (`POST /sessions`, `PATCH /sessions/{id}`),
 * string to string. Up to 16 keys; keys 1-64 characters of `A-Za-z0-9_.-`, values up to 256.
 */
export type SessionMetadata = Record<string, string>

interface WebhookEventBase<E extends WebhookEventType, T> {
  event: E
  session_id: string
  /** The session's `metadata` when the event was sent: route on it without a lookup. `{}` when unset; absent on a server older than this field. */
  session_metadata?: SessionMetadata
  data: T
  timestamp: string
}

/** Discriminated union of the events with a documented payload; narrow on `event`. */
export type KnownWebhookEvent =
  | WebhookEventBase<"message" | "message.sent", IncomingMessage>
  | WebhookEventBase<"receipt", ReceiptData>
  | WebhookEventBase<"connected", { phone: string }>
  | WebhookEventBase<"disconnected", DisconnectedData>
  | WebhookEventBase<"qr", { qr: string }>
  | WebhookEventBase<"pairing.failed", PairingFailedData>
  | WebhookEventBase<"pairing.succeeded", PairingSucceededData>

export interface WebhookEvent<T = unknown> {
  event: WebhookEventType
  session_id: string
  /** The session's `metadata` when the event was sent. `{}` when unset; absent on a server older than this field. */
  session_metadata?: SessionMetadata
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
  /** Max age of `x-wi-timestamp` in seconds (replay protection). Default 300. */
  toleranceSeconds?: number
  onReceipt?: (event: WebhookEvent<ReceiptData>) => void | Promise<void>
  onMessage?: (event: WebhookEvent<IncomingMessage>) => void | Promise<void>
  onMessageSent?: (event: WebhookEvent<IncomingMessage>) => void | Promise<void>
  onConnected?: (event: WebhookEvent<{ phone: string }>) => void | Promise<void>
  onDisconnected?: (event: WebhookEvent<DisconnectedData>) => void | Promise<void>
  onQR?: (event: WebhookEvent<{ qr: string }>) => void | Promise<void>
  onPairingFailed?: (event: WebhookEvent<PairingFailedData>) => void | Promise<void>
  onPairingSucceeded?: (event: WebhookEvent<PairingSucceededData>) => void | Promise<void>
  /** Catch-all handler for any event type */
  onEvent?: (event: WebhookEvent) => void | Promise<void>
}
