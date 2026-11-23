import { get, importRows, save, remove } from "./store"
import { provider, retryRead } from "./provider"
import { seal, unseal } from "./google"
import { budget } from "./limits"
function graph<T>(path: string, params: Record<string, string>, token: string) {
  const version = process.env.META_GRAPH_VERSION
  if (!/^v\d+\.\d+$/.test(version ?? ""))
    throw new Error(
      "Set META_GRAPH_VERSION to the supported version of your Meta app.",
    )
  return retryRead(() =>
    provider<T>(
      "https://graph.facebook.com/" +
        version +
        "/" +
        path +
        "?" +
        new URLSearchParams(params),
      { headers: { Authorization: "Bearer " + token } },
    ),
  )
}
type Media = {
  id: string
  media_product_type: string
  permalink: string
  timestamp: string
}
export async function instagram(request: Request, action: string) {
  const row = await get("connection", "instagram")
  if (action === "status" && request.method === "GET")
    return {
      connected: Boolean(row),
      configured: Boolean(
        process.env.META_PAGE_TOKEN &&
          process.env.META_PAGE_ID &&
          process.env.META_GRAPH_VERSION,
      ),
      sync: (await get("sync", "instagram"))?.data.at,
    }
  if (request.method !== "POST") return
  if (action === "disconnect") {
    await remove("connection", "instagram")
    return { ok: true }
  }
  if (action === "connect") {
    const token = process.env.META_PAGE_TOKEN
    if (!token) throw new Error("Set the owner Page token on the server.")
    const page = await graph<{
      id: string
      instagram_business_account?: { id: string }
    }>("me", { fields: "id,instagram_business_account" }, token)
    if (
      page.id !== process.env.META_PAGE_ID ||
      !page.instagram_business_account
    )
      throw new Error(
        "This token must belong to the configured Page linked to your professional Instagram account.",
      )
    await save("connection", "instagram", {
      token: seal(token),
      owner: page.instagram_business_account.id,
    })
    return { ok: true }
  }
  if (action === "sync") {
    if (!row) throw new Error("Connect Instagram in Settings.")
    if (!(await budget("instagram-sync", 1, 1, 300000)).ok)
      throw new Error("Try another sync in five minutes.")
    const token = unseal(String(row.data.token)),
      owner = String(row.data.owner)
    let after = ""
    do {
      const batch = await graph<{
        data: Media[]
        paging?: { next?: string; cursors?: { after: string } }
      }>(
        owner + "/media",
        {
          fields: "id,media_product_type,timestamp,permalink",
          limit: "50",
          ...(after ? { after } : {}),
        },
        token,
      )
      for (const reel of batch.data.filter(
        (item) => item.media_product_type === "REELS",
      )) {
        const insights = await graph<{
          data: { name: string; values: { value: number }[] }[]
        }>(reel.id + "/insights", { metric: "reach,views,saved,shares" }, token)
        const metrics = Object.fromEntries(
          insights.data.map((m) => [m.name, m.values[0]?.value ?? null]),
        )
        await importRows("reel", [
          {
            id: reel.id,
            data: {
              owner,
              date: reel.timestamp,
              link: reel.permalink,
              ...metrics,
            },
          },
        ])
      }
      after = batch.paging?.next ? (batch.paging.cursors?.after ?? "") : ""
    } while (after)
    await save("sync", "instagram", { at: new Date().toISOString() })
    return { ok: true }
  }
}
