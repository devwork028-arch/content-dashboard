export type Fetcher = typeof fetch
export class ProviderError extends Error {
  constructor(
    public status: number,
    public reason: string,
  ) {
    super(
      "Provider request failed (" +
        status +
        (reason ? ", " + reason : "") +
        ").",
    )
  }
}
export async function provider<T>(
  url: string,
  init: RequestInit = {},
  fetcher: Fetcher = fetch,
): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(8000),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? ""
    throw new ProviderError(
      response.status,
      /^[\w-]{1,60}$/.test(reason) ? reason : "",
    )
  }
  return body as T
}
export async function retryRead<T>(
  read: () => Promise<T>,
  pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read()
    } catch (error) {
      if (
        !(error instanceof ProviderError) ||
        attempt >= 2 ||
        !(
          [429, 500, 502, 503, 504].includes(error.status) ||
          error.reason === "rateLimitExceeded" ||
          error.reason === "userRateLimitExceeded"
        )
      )
        throw error
      await pause(500 * 2 ** attempt)
    }
  }
}
