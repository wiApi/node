export class WiError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "WiError"
    this.status = status
    this.code = code
  }

  static async fromResponse(res: Response): Promise<WiError> {
    let message = `HTTP ${res.status}`
    let code: string | undefined

    try {
      const body = await res.json() as Record<string, unknown>
      // Current shape: { error: { code, message } }. Legacy flat shape
      // { error: string, message?, code? } is still read (engine/compat routes).
      const nested = body.error && typeof body.error === "object"
        ? body.error as Record<string, unknown>
        : null
      if (nested) {
        if (typeof nested.message === "string") message = nested.message
        if (typeof nested.code === "string") code = nested.code
      } else {
        if (typeof body.message === "string") message = body.message
        if (typeof body.error === "string") message = body.error
        if (typeof body.code === "string") code = body.code
      }
    } catch {
      // non-JSON body
    }

    return new WiError(message, res.status, code)
  }
}
