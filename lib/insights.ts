import { access, yt } from "./google"
import { get, save } from "./store"
import { provider, retryRead } from "./provider"
import { shiftDay } from "./calendar"
export type Report = Record<string, string | number>[]
export interface Snapshot {
  at: string
  days: number
  daily: Report
  videos: Report
  formats: Report
  traffic: Report
  countries: Report
  devices: Report
}
const metrics =
  "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments,shares"
export async function report(
  token: string,
  start: string,
  end: string,
  params: Record<string, string>,
) {
  const body = await retryRead(() =>
    provider<{
      columnHeaders: { name: string }[]
      rows?: Array<Array<string | number>>
    }>(
      "https://youtubeanalytics.googleapis.com/v2/reports?" +
        new URLSearchParams({
          ids: "channel==MINE",
          startDate: start,
          endDate: end,
          ...params,
        }),
      { headers: { Authorization: "Bearer " + token } },
    ),
  )
  return (body.rows ?? []).map((row) =>
    Object.fromEntries(body.columnHeaders.map(({ name }, i) => [name, row[i]])),
  ) as Report
}
export const endDay = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
export async function syncInsights() {
  if (!(await get("connection", "google"))) return { connected: false }
  const token = await access(),
    end = endDay(),
    at = new Date().toISOString()
  for (const days of [7, 28, 90]) {
    const start = shiftDay(end, 1 - days)
    const query = (dimensions: string, extra: Record<string, string> = {}) =>
      report(token, start, end, { dimensions, metrics: "views", ...extra })
    const [daily, formats, traffic, countries, devices] = await Promise.all([
      query("day", {
        metrics: "views,estimatedMinutesWatched,subscribersGained",
      }),
      query("creatorContentType"),
      query("insightTrafficSourceType"),
      query("country"),
      query("deviceType"),
    ])
    const videos: Report = []
    for (let index = 1; ; index += 200) {
      const batch = await query("video", {
        metrics,
        sort: "-views",
        maxResults: "200",
        startIndex: String(index),
      })
      videos.push(...batch)
      if (batch.length < 200) break
    }
    for (let i = 0; i < videos.length; i += 50) {
      const rows = videos.slice(i, i + 50)
      const details = await yt<{
        items: {
          id: string
          snippet: { title: string; publishedAt: string }
          contentDetails: { duration: string }
        }[]
      }>(token, "videos", {
        part: "snippet,contentDetails",
        id: rows.map((v) => v.video).join(","),
      })
      for (const row of rows) {
        const v = details.items.find((v) => v.id === row.video)
        if (v) {
          row.title = v.snippet.title
          row.publishedAt = v.snippet.publishedAt
          row.duration = duration(v.contentDetails.duration)
        }
      }
    }
    // Ask for each individual curve: the retention API accepts one video filter.
    for (let i = 0; i < videos.length; i += 4) {
      await Promise.all(
        videos.slice(i, i + 4).map(async (video) => {
          const points = await report(token, start, end, {
            dimensions: "elapsedVideoTimeRatio",
            metrics: "audienceWatchRatio",
            filters: "video==" + video.video,
          })
          const threeSeconds = points.find(
            (p) =>
              Number(p.elapsedVideoTimeRatio) * Number(video.duration) >= 3,
          )
          if (threeSeconds)
            video.hookRetention = Number(threeSeconds.audienceWatchRatio) * 100
          await save("retention", video.video + ":" + days, { at, points })
        }),
      )
    }
    await save("insights", String(days), {
      at,
      days,
      daily,
      videos,
      formats,
      traffic,
      countries,
      devices,
    })
  }
  return { at }
}
export function duration(iso: string) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso)
  return m
    ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
    : 0
}
export async function retention(video: string, days: number) {
  const snapshot = await get("insights", String(days))
  if (
    !(snapshot?.data.videos as Report | undefined)?.some(
      (v) => v.video === video,
    )
  )
    throw new Error("Sync this video first.")
  const id = video + ":" + days
  const cached = await get("retention", id)
  if (cached?.data.at === snapshot!.data.at) return cached.data
  const end = endDay()
  const points = await report(await access(), shiftDay(end, 1 - days), end, {
    dimensions: "elapsedVideoTimeRatio",
    metrics: "audienceWatchRatio",
    filters: "video==" + video,
  })
  const data = { points, at: snapshot!.data.at }
  await save("retention", id, data)
  return data
}
