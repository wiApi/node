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
      if (typeof body.message === "string") message = body.message
      if (typeof body.error === "string") message = body.error
      if (typeof body.code === "string") code = body.code
    } catch {
      // non-JSON body
    }

    return new WiError(message, res.status, code)
  }
}
