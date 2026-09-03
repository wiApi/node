import type { WiConfig } from "./types.ts"
import type {
  MarkReadParams,
  MessageResponse,
  PairPhoneResult,
  PresenceParams,
  QRCode,
  SendAudioParams,
  SendContactParams,
  SendDocumentParams,
  SendImageParams,
  SendLinkParams,
  SendLocationParams,
  SendPollParams,
  SendReactionParams,
  SendStickerParams,
  SendTextParams,
  SendVideoParams,
  SessionStatus,
} from "./types.ts"
import { WiError } from "./error.ts"

export class Session {
  readonly id: string
  readonly #config: Required<WiConfig>

  constructor(id: string, config: Required<WiConfig>) {
    this.id = id
    this.#config = config
  }

  // ─── HTTP ──────────────────────────────────────────────────────────────────

  #url(path: string): string {
    return `${this.#config.baseUrl}/sessions/${this.id}${path}`
  }

  async #post<T>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.#config.timeout)

    try {
      const res = await fetch(this.#url(path), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.#config.apiKey,
        },
        body: body !== undefined ? JSON.stringify(body) : null,
        signal: controller.signal,
      })

      if (!res.ok) throw await WiError.fromResponse(res)
      return res.json() as Promise<T>
    } finally {
      clearTimeout(timer)
    }
  }

  async #get<T>(path: string): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.#config.timeout)

    try {
      const res = await fetch(this.#url(path), {
        headers: { "x-api-key": this.#config.apiKey },
        signal: controller.signal,
      })

      if (!res.ok) throw await WiError.fromResponse(res)
      return res.json() as Promise<T>
    } finally {
      clearTimeout(timer)
    }
  }

  // ─── Session lifecycle ─────────────────────────────────────────────────────

  /** Get current session status and phone number if connected */
  status(): Promise<SessionStatus> {
    return this.#get("/status")
  }

  /** Get QR code image (base64 PNG) for scanning */
  qr(): Promise<QRCode> {
    return this.#get("/qr")
  }

  /** Start the connection flow. Poll qr() or status() for updates */
  connect(): Promise<void> {
    return this.#post("/connect")
  }

  /** Disconnect from WhatsApp (keeps session keys) */
  disconnect(): Promise<void> {
    return this.#post("/disconnect")
  }

  /** Logout and delete session keys */
  logout(): Promise<void> {
    return this.#post("/logout")
  }

  /**
   * Pair with a phone number instead of scanning QR.
   * Returns a 8-character pairing code to enter on the phone.
   */
  pairPhone(phone: string): Promise<PairPhoneResult> {
    return this.#post("/pairphone", { phone })
  }

  // ─── Send ──────────────────────────────────────────────────────────────────

  sendText(params: SendTextParams): Promise<MessageResponse> {
    return this.#post("/messages/send-text", params)
  }

  sendImage(params: SendImageParams): Promise<MessageResponse> {
    return this.#post("/messages/send-image", params)
  }

  sendAudio(params: SendAudioParams): Promise<MessageResponse> {
    return this.#post("/messages/send-audio", params)
  }

  sendVideo(params: SendVideoParams): Promise<MessageResponse> {
    return this.#post("/messages/send-video", params)
  }

  sendDocument(params: SendDocumentParams): Promise<MessageResponse> {
    return this.#post("/messages/send-document", params)
  }

  sendLocation(params: SendLocationParams): Promise<MessageResponse> {
    return this.#post("/messages/send-location", params)
  }

  sendContact(params: SendContactParams): Promise<MessageResponse> {
    return this.#post("/messages/send-contact", params)
  }

  sendSticker(params: SendStickerParams): Promise<MessageResponse> {
    return this.#post("/messages/send-sticker", params)
  }

  sendPoll(params: SendPollParams): Promise<MessageResponse> {
    return this.#post("/messages/send-poll", params)
  }

  sendLink(params: SendLinkParams): Promise<MessageResponse> {
    return this.#post("/messages/send-link", params)
  }

  react(params: SendReactionParams): Promise<void> {
    return this.#post("/chat/react", params)
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────

  markRead(params: MarkReadParams): Promise<void> {
    return this.#post("/chat/markread", params)
  }

  presence(params: PresenceParams): Promise<void> {
    return this.#post("/chat/presence", params)
  }
}
