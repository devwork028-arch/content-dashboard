import { randomUUID, createHash } from "node:crypto"
import { z } from "zod"
import { access, yt } from "./google"
import { save, get, list } from "./store"
import { youtubeBudget } from "./research"
import { provider } from "./provider"
type Obj = Record<string, unknown>
type Video = { id: string; etag: string; snippet: Obj; status: Obj }
type Plan = {
  video: string
  before: Obj
  after: Obj
  kind: "metadata" | "playlist" | "thumbnail"
  reverse?: boolean
}
const videoId = z.string().regex(/^[\w-]{11}$/)
const changes = z.object({
  title: z.string().min(1).max(60).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  categoryId: z.string().regex(/^\d+$/).optional(),
  privacyStatus: z.enum(["private", "public", "unlisted"]).optional(),
  publishAt: z.iso.datetime().nullable().optional(),
})
const fields = [
  "title",
  "description",
  "categoryId",
  "tags",
  "privacyStatus",
  "publishAt",
]
function metadata(v: Video): Obj {
  return Object.fromEntries(
    fields.map((k) => [
      k,
      v.snippet[k] ?? v.status[k] ?? (k === "tags" ? [] : null),
    ]),
  )
}
function pick(obj: Obj, keys: string[]) {
  return Object.fromEntries(
    keys.filter((k) => obj[k] != null).map((k) => [k, obj[k]]),
  )
}
export function diff(a: Obj, b: Obj) {
  return Object.keys(b)
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((key) => ({ key, before: a[key], after: b[key] }))
}
export function inverse(plan: Plan): Plan {
  return {
    ...plan,
    before: plan.after,
    after: plan.before,
    reverse: !plan.reverse,
  }
}
export async function confirmPlan(
  plan: Plan,
  current: Obj,
  confirmed: boolean,
  write: () => Promise<void>,
) {
  if (!confirmed) throw new Error("Confirmation is required.")
  if (diff(current, plan.before).length)
    throw new Error("YouTube changed. Preview again.")
  await write()
}
async function ownerVideo(token: string, id: string) {
  const response = await yt<{ items: Video[] }>(token, "videos", {
    part: "snippet,status",
    id: videoId.parse(id),
  })
  const video = response.items[0]
  if (!video || video.snippet.channelId !== process.env.YOUTUBE_CHANNEL_ID)
    throw new Error("Choose an existing video on the owner channel.")
  return video
}
async function playlist(token: string, id: string, video: string) {
  const result = await yt<{ items: { id: string }[] }>(token, "playlistItems", {
    part: "id",
    playlistId: id,
    videoId: video,
  })
  return result.items[0]?.id
}
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
async function thumbnail(video: Video) {
  const images = video.snippet.thumbnails as Record<string, { url: string }>
  const url = new URL((images.maxres ?? images.standard ?? images.high).url)
  if (!url.hostname.endsWith(".ytimg.com") || url.protocol !== "https:")
    throw new Error("Thumbnail backup unavailable.")
  const response = await fetch(url, { cache: "no-store", redirect: "error" })
  if (!response.ok) throw new Error("Thumbnail backup unavailable.")
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > 2097152) throw new Error("Thumbnail exceeds 2 MB.")
  return {
    image: bytes.toString("base64"),
    mime: "image/jpeg",
    digest: hash(bytes),
  }
}
function summary(plan: Plan) {
  return plan.kind === "thumbnail"
    ? [
        {
          key: "thumbnail SHA-256",
          before: plan.before.digest,
          after: plan.after.digest,
        },
      ]
    : diff(plan.before, plan.after)
}
export async function edits(request: Request, action: string) {
  if (action === "history" && request.method === "GET")
    return (await list("youtube-edit"))
      .filter((r) => r.data.state === "applied")
      .map((r) => ({
        id: r.id,
        video: r.data.video,
        kind: r.data.kind,
        at: r.updatedAt,
      }))
  if (request.method !== "POST") return
  const input = await request.json()
  if (action === "preview" || action === "revert") {
    let plan: Plan
    const token = await access(true)
    if (action === "revert") {
      const row = await get("youtube-edit", z.uuid().parse(input.id))
      if (row?.data.state !== "applied")
        throw new Error("Select an applied edit.")
      plan = inverse(row.data as unknown as Plan)
      // YouTube transcodes custom thumbnails. Compare the last observed remote bytes.
      if (plan.kind === "thumbnail" && row.data.remoteDigest)
        plan.before = { ...plan.before, digest: row.data.remoteDigest }
    } else {
      const video = await ownerVideo(token, input.video)
      if (input.kind === "playlist") {
        const id = z
          .string()
          .regex(/^[\w-]{10,100}$/)
          .parse(input.playlist)
        if (await playlist(token, id, video.id))
          throw new Error("Video is already in this playlist.")
        plan = {
          video: video.id,
          kind: "playlist",
          before: { playlist: id, present: false },
          after: { playlist: id, present: true },
        }
      } else if (input.kind === "thumbnail") {
        const image = z.string().base64().max(2796204).parse(input.image)
        const bytes = Buffer.from(image, "base64")
        const mime =
          bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
            ? "image/png"
            : bytes.subarray(0, 3).toString("hex") === "ffd8ff"
              ? "image/jpeg"
              : ""
        if (!mime || bytes.length > 2097152)
          throw new Error("Choose a JPEG or PNG up to 2 MB.")
        plan = {
          video: video.id,
          kind: "thumbnail",
          before: await thumbnail(video),
          after: { image, mime, digest: hash(bytes) },
        }
      } else {
        const before = metadata(video),
          after = { ...before, ...changes.parse(input.changes) }
        if (
          after.publishAt &&
          (after.privacyStatus !== "private" ||
            Date.parse(String(after.publishAt)) <= Date.now())
        )
          throw new Error(
            "A scheduled video requires a future time and private visibility.",
          )
        plan = { video: video.id, kind: "metadata", before, after }
      }
    }
    const delta = summary(plan)
    if (!delta.length) throw new Error("No changes to apply.")
    const id = randomUUID()
    await save(
      "youtube-edit",
      id,
      { ...plan, state: "preview", expires: Date.now() + 600000 },
      0,
    )
    return { id, delta }
  }
  if (action === "confirm") {
    const { id, confirm } = z
      .object({ id: z.uuid(), confirm: z.literal(true) })
      .parse(input)
    const row = await get("youtube-edit", id)
    if (row?.data.state !== "preview" || Number(row.data.expires) < Date.now())
      throw new Error("Preview expired. Preview again.")
    const plan = row.data as unknown as Plan
    const token = await access(true),
      video = await ownerVideo(token, plan.video)
    const item =
      plan.kind === "playlist"
        ? await playlist(token, String(plan.before.playlist), plan.video)
        : undefined
    const current =
      plan.kind === "metadata"
        ? metadata(video)
        : plan.kind === "playlist"
          ? { playlist: plan.before.playlist, present: Boolean(item) }
          : await thumbnail(video)
    const before =
      plan.kind === "thumbnail" ? { digest: plan.before.digest } : plan.before
    await confirmPlan({ ...plan, before }, current, confirm, async () => {
      await save(
        "youtube-edit",
        id,
        { ...row.data, state: "sending" },
        row.revision,
      )
      if (plan.kind === "metadata") {
        const snippet = pick({ ...video.snippet, ...plan.after }, [
          "title",
          "description",
          "categoryId",
          "tags",
          "defaultLanguage",
          "defaultAudioLanguage",
        ])
        const status = pick({ ...video.status, ...plan.after }, [
          "privacyStatus",
          "publishAt",
          "license",
          "embeddable",
          "publicStatsViewable",
          "selfDeclaredMadeForKids",
          "containsSyntheticMedia",
        ])
        const parts: Obj = {}
        if (
          diff(plan.before, plan.after).some((d) =>
            ["privacyStatus", "publishAt"].includes(d.key),
          )
        )
          parts.status = status
        if (
          diff(plan.before, plan.after).some(
            (d) => !["privacyStatus", "publishAt"].includes(d.key),
          )
        )
          parts.snippet = snippet
        await yt(
          token,
          "videos",
          { part: Object.keys(parts).join(",") },
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "If-Match": video.etag,
            },
            body: JSON.stringify({ id: plan.video, ...parts }),
          },
          50,
        )
      } else if (plan.kind === "playlist") {
        if (plan.after.present)
          await yt(
            token,
            "playlistItems",
            { part: "snippet" },
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                snippet: {
                  playlistId: plan.after.playlist,
                  resourceId: { kind: "youtube#video", videoId: plan.video },
                },
              }),
            },
            50,
          )
        else
          await yt(
            token,
            "playlistItems",
            { id: item! },
            { method: "DELETE" },
            50,
          )
      } else {
        await youtubeBudget(50, 150)
        await provider(
          "https://www.googleapis.com/upload/youtube/v3/thumbnails/set?uploadType=media&videoId=" +
            plan.video,
          {
            method: "POST",
            headers: {
              Authorization: "Bearer " + token,
              "Content-Type": String(plan.after.mime),
            },
            body: new Uint8Array(
              Buffer.from(String(plan.after.image), "base64"),
            ),
          },
        )
      }
    })
    await save("youtube-edit", id, {
      ...row.data,
      state: "applied",
      ...(plan.kind === "thumbnail"
        ? {
            remoteDigest: (await thumbnail(await ownerVideo(token, plan.video)))
              .digest,
          }
        : {}),
    })
    return { ok: true }
  }
}
