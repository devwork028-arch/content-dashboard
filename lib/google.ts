import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { cookieOptions, equal, session, signature } from "./auth"
import { get, save, remove } from "./store"
import { provider, retryRead } from "./provider"
import { youtubeBudget } from "./research"

const prefix = "https://www.googleapis.com/auth/"
export const editScope = prefix + "youtube.force-ssl"
const callback = () => process.env.APP_URL + "/api/google/callback"
function key() {
  const value = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "base64")
  if (value.length !== 32)
    throw new Error("Configure a 32-byte TOKEN_ENCRYPTION_KEY.")
  return value
}
export function seal(text: string) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), nonce)
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  return [nonce, cipher.getAuthTag(), data]
    .map((v) => v.toString("base64"))
    .join(".")
}
export function unseal(text: string) {
  const [nonce, tag, data] = text
    .split(".")
    .map((v) => Buffer.from(v, "base64"))
  const cipher = createDecipheriv("aes-256-gcm", key(), nonce)
  cipher.setAuthTag(tag)
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8")
}
type Token = { access_token: string; refresh_token?: string; scope?: string }
export function exchange(fields: Record<string, string>, fetcher = fetch) {
  return provider<Token>(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        ...fields,
      }),
    },
    fetcher,
  )
}
export async function access(write = false) {
  const account = await get("connection", "google")
  if (!account) throw new Error("Connect YouTube in Settings.")
  if (write && !String(account.data.scope).split(" ").includes(editScope))
    throw new Error("Enable YouTube edits in Settings.")
  return (
    await exchange({
      grant_type: "refresh_token",
      refresh_token: unseal(String(account.data.refresh)),
    })
  ).access_token
}
export async function oauth(request: Request, action: string) {
  const jar = await cookies()
  if (action === "disconnect" && request.method === "POST") {
    const row = await get("connection", "google")
    if (row) {
      const revoked = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        body: new URLSearchParams({ token: unseal(String(row.data.refresh)) }),
      })
      if (!revoked.ok && revoked.status !== 400)
        throw new Error("Google revocation failed. Try again.")
      await remove("connection", "google")
    }
    return { ok: true }
  }
  const url = new URL(request.url)
  if (action === "connect" && request.method === "POST") {
    key()
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
      throw new Error("Set Google OAuth credentials.")
    const state = randomBytes(32).toString("hex")
    jar.set("google-state", signature(state + (await session())), {
      ...cookieOptions,
      maxAge: 600,
    })
    const scopes = [
      prefix + "yt-analytics.readonly",
      prefix + "youtube.readonly",
    ]
    if (url.searchParams.get("edit") === "1") scopes.push(editScope)
    return NextResponse.redirect(
      "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          response_type: "code",
          client_id: process.env.GOOGLE_CLIENT_ID,
          redirect_uri: callback(),
          access_type: "offline",
          prompt: "consent",
          scope: scopes.join(" "),
          state,
        }),
      303,
    )
  }
  if (action === "callback" && request.method === "GET") {
    const saved = jar.get("google-state")?.value
    jar.delete("google-state")
    if (
      !saved ||
      !equal(
        saved,
        signature(url.searchParams.get("state") + String(await session())),
      )
    )
      throw new Error("OAuth request expired.")
    const token = await exchange({
      grant_type: "authorization_code",
      redirect_uri: callback(),
      code: url.searchParams.get("code") ?? "",
    })
    if (!token.refresh_token)
      throw new Error("Reconnect and grant offline access.")
    const owner = await yt<{ items: { id: string }[] }>(
      token.access_token,
      "channels",
      { part: "id", mine: "true" },
    )
    if (!owner.items[0] || owner.items[0].id !== process.env.YOUTUBE_CHANNEL_ID)
      throw new Error("Selected channel does not match YOUTUBE_CHANNEL_ID.")
    await save("connection", "google", {
      refresh: seal(token.refresh_token),
      scope: token.scope ?? "",
      channel: owner.items[0].id,
    })
    return NextResponse.redirect(process.env.APP_URL + "/settings", 303)
  }
}
export function yt<T>(
  token: string,
  path: string,
  params: Record<string, string>,
  init: RequestInit = {},
  cost = 1,
) {
  const read = async () => {
    await youtubeBudget(cost, init.method ? 150 : 0)
    return provider<T>(
      "https://www.googleapis.com/youtube/v3/" +
        path +
        "?" +
        new URLSearchParams(params),
      {
        ...init,
        headers: { Authorization: "Bearer " + token, ...init.headers },
      },
    )
  }
  return init.method ? read() : retryRead(read)
}
