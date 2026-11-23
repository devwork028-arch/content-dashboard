import { z } from "zod"
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    "/api/" + path,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  )
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? "Request failed.")
  return result as T
}
export const idSchema = z.string().regex(/^[\w:-]{1,180}$/)
