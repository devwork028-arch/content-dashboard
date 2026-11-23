import { XMLParser } from "fast-xml-parser"
import { provider, type Fetcher } from "./provider"

export type Candidate = {
  title: string
  url: string
  source: string
  game: string
  published: string
  views: number
  comments: number
  official?: boolean
}
const leak =
  /\b(leak(?:s|ed)?|datamin(?:e|ed|ing)|stolen build|early build|unreleased footage)\b/i
const rumor =
  /\b(rumou?rs?|speculation|unconfirmed|allegedly|insider|release date|launch date)\b/i
const pain =
  /\b(ranked|lag|delay|matchmaking|nerf|bug|queue|crash|grind|price|wait|rage)\b/i
const comedy = /\b(rage|reaction|fail|bug|nerf|ranked|meme|delay|npc|patch)\b/i
export function brief(item: Candidate, competition: number, now = Date.now()) {
  if (leak.test(item.title)) return
  const releaseClaim =
    /release date|launch date|(?:releases?|launch(?:es|ing)?) (?:on |in )?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|20\d{2}|\d)/i.test(
      item.title,
    )
  if (!item.official && releaseClaim) return
  const age = Math.max(1, (now - Date.parse(item.published)) / 3600000 || 168)
  const factors = {
    velocity: Math.min(
      10,
      1 + Math.log10(1 + (item.views + 5 * item.comments) / age) * 2,
    ),
    pain: pain.test(item.title) ? 9 : 4,
    comedy: comedy.test(item.title) ? 9 : 5,
    freshness: Math.max(1, 10 - age / 18),
    lowCompetition: Math.max(1, 10 - competition),
  }
  const score =
    Math.round(
      (0.3 * factors.velocity +
        0.2 * factors.pain +
        0.25 * factors.comedy +
        0.15 * factors.freshness +
        0.1 * factors.lowCompetition) *
        10,
    ) / 10
  const flagged = !item.official && rumor.test(item.title)
  return {
    title: item.title,
    url: item.url,
    source: item.source,
    game: item.game,
    published: item.published,
    views: item.views,
    comments: item.comments,
    flagged,
    score,
    factors,
    whyNow:
      item.source +
      " item published " +
      (item.published.slice(0, 10) || "on an unknown date") +
      " with " +
      item.views +
      " public views/points and " +
      item.comments +
      " comments.",
    angles:
      factors.pain === 9
        ? [
            "Treat a familiar frustration like a formal competition.",
            "Reverse who gets blamed for the problem.",
          ]
        : [
            "Use an overreaction to a small change.",
            "Play the game mechanic as an everyday rule.",
          ],
    relatable:
      factors.pain === 9
        ? "A player expects a quick session and hits a familiar roadblock."
        : "One friend cares deeply about the news while another is still learning the game.",
    roles: [
      "A takes the situation seriously",
      "B escalates the misunderstanding",
      "C reacts or calls out the actual problem",
    ],
    hooks: [
      "Open on the frustrating outcome.",
      "Start as someone confidently makes the wrong call.",
    ],
    keywords: [
      item.game,
      item.game + " funny moments",
      item.game +
        " " +
        (factors.pain === 9 ? "player reactions" : "community news"),
    ],
    risks: flagged
      ? "Unverified claim. Confirm with the publisher and avoid citing a release date from this source."
      : "Check context, source rights, and sensitivity before drafting.",
  }
}
export async function redditToken(
  id: string,
  secret: string,
  userAgent: string,
  fetcher: Fetcher = fetch,
) {
  return (
    await provider<{ access_token: string }>(
      "https://www.reddit.com/api/v1/access_token",
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + Buffer.from(id + ":" + secret).toString("base64"),
          "User-Agent": userAgent,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      },
      fetcher,
    )
  ).access_token
}
type RedditPost = {
  title: string
  permalink: string
  created_utc: number
  score: number
  num_comments: number
  over_18?: boolean
  spoiler?: boolean
  link_flair_text?: string
}
export async function redditCandidates(
  id: string,
  secret: string,
  userAgent: string,
  games: string[],
  keywords: string,
  fetcher: Fetcher = fetch,
) {
  const token = await redditToken(id, secret, userAgent, fetcher)
  const result = await provider<{ data: { children: { data: RedditPost }[] } }>(
    "https://oauth.reddit.com/r/Tekken+GTA6+PhantomBladeZero+gaming/hot?limit=60",
    { headers: { Authorization: "Bearer " + token, "User-Agent": userAgent } },
    fetcher,
  )
  return result.data.children.flatMap(({ data: post }) => {
    if (
      post.over_18 ||
      post.spoiler ||
      leak.test(post.link_flair_text ?? "") ||
      !post.permalink.startsWith("/r/")
    )
      return []
    const topic = post.title + " " + post.permalink
    const game = gameFor(topic, games, keywords)
    if (!game) return []
    return [
      {
        title: post.title,
        url: "https://www.reddit.com" + post.permalink,
        source: "Reddit",
        game,
        published: new Date(post.created_utc * 1000).toISOString(),
        views: Math.max(0, post.score),
        comments: post.num_comments,
      },
    ]
  })
}
export function gameFor(text: string, games: string[], keywords: string) {
  const simplified = text.toLowerCase().replace(/[^a-z0-9]/g, "")
  return (
    games.find((game) => {
      const name = game.toLowerCase().replace(/[^a-z0-9]/g, "")
      return (
        simplified.includes(name) ||
        (name === "tekken8" && simplified.includes("tekken")) ||
        (name === "gta6" &&
          /gta6|gtavi|grandtheftauto6|grandtheftautovi/.test(simplified))
      )
    }) ??
    (keywords
      .split(",")
      .some(
        (word) =>
          word.trim() && text.toLowerCase().includes(word.trim().toLowerCase()),
      )
      ? games.find((game) => game === "Custom games")
      : undefined)
  )
}
type FeedEntry = {
  title?: string
  link?: string | { "@_href"?: string } | { "@_href"?: string }[]
  pubDate?: string
  published?: string
  updated?: string
}
export async function rssCandidates(
  url: string,
  games: string[],
  keywords: string,
  fetcher: Fetcher = fetch,
): Promise<Candidate[]> {
  const response = await fetcher(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
    redirect: "error",
  })
  if (!response.ok) throw new Error("RSS feed unavailable.")
  const document = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
  }).parse((await response.text()).slice(0, 1_000_000))
  const input = document.rss?.channel?.item ?? document.feed?.entry ?? []
  const entries: FeedEntry[] = Array.isArray(input) ? input : [input]
  const host = new URL(url).hostname
  return entries.slice(0, 25).flatMap((entry) => {
    const link =
      typeof entry.link === "string"
        ? entry.link
        : Array.isArray(entry.link)
          ? entry.link[0]?.["@_href"]
          : entry.link?.["@_href"]
    const published = Date.parse(
      entry.pubDate ?? entry.published ?? entry.updated ?? "",
    )
    if (
      typeof entry.title !== "string" ||
      !link?.startsWith("https://") ||
      !Number.isFinite(published)
    )
      return []
    const game =
      gameFor(entry.title + " " + link, games, keywords) ??
      (host.endsWith(".tekken.com")
        ? games.find((value) => value === "Tekken 8")
        : undefined)
    return game
      ? [
          {
            title: entry.title,
            url: link,
            source: host,
            game,
            published: new Date(published).toISOString(),
            views: 0,
            comments: 0,
            official: /(^|\.)(tekken\.com|rockstargames\.com)$/.test(host),
          },
        ]
      : []
  })
}
