import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"
import { cookies } from "next/headers"
export const sessionCookie = "content-desk-session"

export function equal(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  )
}
export function passwordValid(password: string) {
  const [salt, digest] = (process.env.OWNER_PASSWORD_HASH ?? "").split(":")
  return Boolean(
    salt &&
      digest &&
      equal(scryptSync(password, salt, 64).toString("hex"), digest),
  )
}
export function signature(value: string) {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32)
    throw new Error("Set SESSION_SECRET to at least 32 characters.")
  return createHmac("sha256", secret).update(value).digest("base64url")
}
export function createSession() {
  const value = Date.now() + 8 * 3600000 + "." + randomBytes(24).toString("hex")
  return value + "." + signature(value)
}
export async function session() {
  const token = (await cookies()).get(sessionCookie)?.value
  if (!token) return
  const [expiry, nonce, mac] = token.split(".")
  if (
    nonce &&
    mac &&
    Number(expiry) > Date.now() &&
    equal(mac, signature(expiry + "." + nonce))
  )
    return token
}
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure:
    process.env.NODE_ENV === "production" &&
    !process.env.APP_URL?.startsWith("http://localhost:"),
  path: "/",
}
