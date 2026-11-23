import { z } from "zod"
import { instagram } from "./instagram"
import { list, get } from "./store"
import { budget } from "./limits"
import { quotaLimit, youtubeBudget } from "./research"
import { oauth } from "./google"
import { edits } from "./edits"
import { retention, syncInsights } from "./insights"
export async function integrations(
  request: Request,
  service: string,
  action: string,
  id: string,
) {
  const period = z.coerce
    .number()
    .pipe(z.union([z.literal(7), z.literal(28), z.literal(90)]))
  if (service === "instagram") return instagram(request, action)
  if (service === "list" && action === "reel" && request.method === "GET")
    return list("reel")
  if (service === "google") return oauth(request, action)
  if (service === "edits") return edits(request, action)
  if (service === "integrations" && request.method === "GET") {
    const google = await get("connection", "google")
    return {
      connected: Boolean(google),
      scope: String(google?.data.scope ?? ""),
      channel: google?.data.channel,
      keys: {
        GoogleOAuth: Boolean(
          process.env.GOOGLE_CLIENT_ID &&
            process.env.GOOGLE_CLIENT_SECRET &&
            process.env.YOUTUBE_CHANNEL_ID &&
            process.env.TOKEN_ENCRYPTION_KEY,
        ),
        YouTubeData: Boolean(process.env.YOUTUBE_API_KEY),
        Reddit: Boolean(
          process.env.REDDIT_CLIENT_ID &&
            process.env.REDDIT_CLIENT_SECRET &&
            process.env.REDDIT_USER_AGENT,
        ),
      },
      remaining: await youtubeBudget(0),
      limit: quotaLimit(),
    }
  }
  if (service === "insights") {
    if (action === "sync" && request.method === "POST") {
      if (!(await budget("manual-analytics", 1, 1, 300000)).ok)
        throw new Error("Try another sync in five minutes.")
      return syncInsights()
    }
    if (request.method === "GET" && action === "retention")
      return retention(
        z
          .string()
          .regex(/^[\w-]{11}$/)
          .parse(id),
        period.parse(new URL(request.url).searchParams.get("days")),
      )
    if (request.method === "GET")
      return (
        (await get("insights", String(period.parse(action))))?.data ?? {
          empty: true,
        }
      )
  }
}
