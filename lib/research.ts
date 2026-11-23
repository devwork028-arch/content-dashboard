import { createHash } from "node:crypto"
import { z } from "zod"
import {
  brief,
  redditCandidates,
  rssCandidates,
  type Candidate,
} from "./research-sources"
import { games, topicStatuses } from "./models"
import { budget } from "./limits"
import { get, importRows, list, save } from "./store"
import { retryRead, provider } from "./provider"
import { idSchema } from "./http"

export const quotaLimit = () =>
  Math.max(100, Number(process.env.YOUTUBE_DAILY_QUOTA) || 10000)
export async function youtubeBudget(cost: number, reserve = 0) {
  const result = await budget("youtube", cost, quotaLimit() - reserve, 86400000)
  if (!result.ok)
    throw new Error("Estimated YouTube quota is too low for this action.")
  return result.remaining + reserve
}
type YouTubeSearch = { items?: { id: { videoId?: string } }[] }
type YouTubeDetail = {
  items?: {
    id: string
    snippet: { title: string; publishedAt: string }
    statistics?: { viewCount?: string; commentCount?: string }
  }[]
}
async function youtubeSearch(game: string) {
  const key = process.env.YOUTUBE_API_KEY!
  const base = "https://www.googleapis.com/youtube/v3/"
  const search = await retryRead(async () => {
    if (!(await budget("youtube-search", 1, 100, 86400000)).ok)
      throw new Error("YouTube search quota exhausted.")
    return provider<YouTubeSearch>(
      base +
        "search?" +
        new URLSearchParams({
          key,
          q: game,
          type: "video",
          part: "id",
          order: "date",
          maxResults: "10",
          regionCode: "IN",
          publishedAfter: new Date(Date.now() - 7 * 86400000).toISOString(),
        }),
    )
  })
  const ids = search.items
    ?.flatMap((item) => (item.id.videoId ? [item.id.videoId] : []))
    .join(",")
  if (!ids) return []
  const videos = await retryRead(async () => {
    await youtubeBudget(1, 200)
    return provider<YouTubeDetail>(
      base +
        "videos?" +
        new URLSearchParams({ key, part: "snippet,statistics", id: ids }),
    )
  })
  return (videos.items ?? []).map((video) => ({
    title: video.snippet.title,
    url: "https://www.youtube.com/watch?v=" + video.id,
    source: "YouTube",
    game,
    published: video.snippet.publishedAt,
    views: Number(video.statistics?.viewCount ?? 0),
    comments: Number(video.statistics?.commentCount ?? 0),
  }))
}
export async function refreshResearch(manual: boolean) {
  const rate = await budget("research-refresh", 1, 1, manual ? 900000 : 3600000)
  if (!rate.ok)
    throw new Error(
      "Research was refreshed recently. Try again in a few minutes.",
    )
  const settings = await get("settings", "owner")
  const selected = (settings?.data.games as string[] | undefined) ?? games
  const keywords = String(
    settings?.data.keywords ?? "gaming comedy,ranked,matchmaking",
  )
  const feeds = [
    process.env.TEKKEN_RSS_URL,
    process.env.ROCKSTAR_RSS_URL,
    ...(
      process.env.RESEARCH_RSS_URLS ??
      "https://feeds.feedburner.com/ign/games-all,https://store.steampowered.com/feeds/news.xml"
    ).split(","),
  ].filter((url): url is string => Boolean(url?.startsWith("https://")))
  const jobs: { name: string; run: Promise<Candidate[]> }[] = feeds.map(
    (url) => ({
      name: new URL(url).hostname,
      run: rssCandidates(url, selected, keywords),
    }),
  )
  if (process.env.YOUTUBE_API_KEY)
    jobs.push(
      ...selected
        .slice(0, 6)
        .map((game) => ({ name: "YouTube " + game, run: youtubeSearch(game) })),
    )
  if (
    process.env.REDDIT_CLIENT_ID &&
    process.env.REDDIT_CLIENT_SECRET &&
    process.env.REDDIT_USER_AGENT
  )
    jobs.push({
      name: "Reddit",
      run: redditCandidates(
        process.env.REDDIT_CLIENT_ID,
        process.env.REDDIT_CLIENT_SECRET,
        process.env.REDDIT_USER_AGENT,
        selected,
        keywords,
      ),
    })
  const results = await Promise.allSettled(jobs.map((job) => job.run))
  const warnings = results.flatMap((result, index) =>
    result.status === "rejected" ? [jobs[index].name + " unavailable"] : [],
  )
  const candidates = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((item) => Date.parse(item.published) > Date.now() - 14 * 86400000)
  const unique = [
    ...new Map(candidates.map((item) => [item.url, item])).values(),
  ]
  const rows = unique.flatMap((item) => {
    const data = brief(
      item,
      unique.filter((other) => other.game === item.game).length / 3,
    )
    return data
      ? [{ id: createHash("sha256").update(item.url).digest("hex"), data }]
      : []
  })
  if (results.length && warnings.length === results.length)
    throw new Error(
      "All research sources failed. Cached results are still available.",
    )
  await importRows("research", rows)
  const state = { at: new Date().toISOString(), count: rows.length, warnings }
  await save("sync", "research", state)
  return state
}
export async function researchApi(
  request: Request,
  action: string,
  id: string,
) {
  if (action === "refresh" && request.method === "POST")
    return refreshResearch(true)
  if (action === "topics" && request.method === "GET") {
    const [topics, states, sync] = await Promise.all([
      list("research"),
      list("topic-status"),
      get("sync", "research"),
    ])
    const statusById = new Map(states.map((row) => [row.id, row.data.status]))
    return {
      topics: topics.map((row) => ({
        ...row,
        data: { ...row.data, status: statusById.get(row.id) ?? "new" },
      })),
      sync: sync?.data,
    }
  }
  if (action === "status" && request.method === "POST") {
    const key = idSchema.parse(id)
    if (!(await get("research", key))) throw new Error("Topic unavailable.")
    const data = z
      .object({ status: z.enum(topicStatuses) })
      .parse(await request.json())
    return save("topic-status", key, data)
  }
}
