import { z } from "zod"

export const platforms = ["YouTube", "Instagram", "X"] as const
export const statuses = [
  "idea",
  "scripted",
  "shot",
  "edited",
  "scheduled",
  "posted",
] as const
export const topicStatuses = ["new", "saved", "used", "dropped"] as const
export const games = ["Tekken 8", "GTA 6", "Phantom Blade Zero", "Custom games"]
const short = z.string().max(300)
const title = short.trim().min(1)
export const webUrl = z.url({ protocol: /^https?$/ }).max(2000)
const count = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
export const models = {
  script: z.object({
    title,
    body: z.string().max(100000),
    format: z.enum(["solo", "trio"]),
    roles: z.array(z.string().max(5000)).length(3),
  }),
  metadata: z.object({
    youtubeTitle: z.string().max(60),
    description: z.string().max(5000),
    tags: short,
    hashtags: short,
    caption: z.string().max(2200),
    instagramHashtags: short.refine(
      (value) =>
        !value.trim() || [4, 5].includes(value.trim().split(/\s+/).length),
      "Use four or five hashtags",
    ),
    onScreen: short,
    x: z.string().max(280),
  }),
  calendar: z.object({
    title,
    platform: z.enum(platforms),
    status: z.enum(statuses),
    at: z.iso.datetime(),
  }),
  competitor: z.object({
    creator: title,
    platform: z.enum(platforms),
    link: webUrl,
    hook: short,
    format: short,
    length: count,
    views: count,
    reason: z.string().max(5000),
  }),
  settings: z.object({
    keywords: z.string().max(1500),
    games: z.array(title).min(1).max(10),
  }),
  x: z.object({
    post: title,
    date: z.iso.date(),
    views: count,
    likes: count,
    replies: count,
    reposts: count,
  }),
}
export type Kind = keyof typeof models
export type Data = Record<string, unknown>
export interface Row {
  kind: string
  id: string
  data: Data
  revision: number
  updatedAt: string
}
export const emptyMetadata = {
  youtubeTitle: "",
  description: "",
  tags: "",
  hashtags: "",
  caption: "",
  instagramHashtags: "",
  onScreen: "",
  x: "",
}
export const scoreFormula =
  "30% trend velocity + 20% relatable pain + 25% comedy potential + 15% freshness + 10% low competition"
