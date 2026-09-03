import type { WiConfig } from "./types.ts"
import { Session } from "./session.ts"

const DEFAULT_BASE_URL = "https://endpoint.wi.api.br"
const DEFAULT_TIMEOUT = 30_000

export class Wi {
  readonly #config: Required<WiConfig>

  constructor(config: WiConfig) {
    if (!config.apiKey) throw new Error("wi-api: apiKey is required")
    this.#config = {
      apiKey: config.apiKey,
      baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    }
  }

  /**
   * Get a session client for the given session ID.
   *
   * @example
   * const session = wi.session("my-instance")
   * await session.sendText({ to: "5511999999999", text: "Hello!" })
   */
  session(id: string): Session {
    return new Session(id, this.#config)
  }
}
