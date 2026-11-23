import { test } from "node:test"
import assert from "node:assert/strict"
import { brief, redditCandidates } from "../lib/research-sources"
import { ProviderError, retryRead } from "../lib/provider"
const now = Date.parse("2026-11-23T06:00:00Z")
const item = {
  title: "Tekken 8 ranked lag",
  url: "https://example.com/story",
  source: "Reddit",
  game: "Tekken 8",
  published: "2026-11-23T04:00:00Z",
  views: 1000,
  comments: 30,
}
test("research prioritizes timely, relatable items and discards leaked material", () => {
  assert.ok(
    brief(item, 1, now)!.score >
      brief({ ...item, title: "Tekken 8 news", views: 0, comments: 0 }, 6, now)!
        .score,
  )
  assert.equal(
    brief({ ...item, title: "Tekken 8 leaked build" }, 1, now),
    undefined,
  )
  assert.equal(
    brief({ ...item, title: "Unconfirmed Tekken 8 rumor" }, 1, now)?.flagged,
    true,
  )
})
test("Reddit uses OAuth and only extracts permitted public metadata", async () => {
  const mock: typeof fetch = async (url, init) => {
    if (String(url).includes("access_token"))
      return Response.json({ access_token: "mock" })
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer mock")
    return Response.json({
      data: {
        children: [
          {
            data: {
              title: item.title,
              permalink: "/r/Tekken/comments/a",
              created_utc: now / 1000,
              score: 8,
              num_comments: 3,
              selftext: "Do not store",
            },
          },
          { data: { spoiler: true } },
        ],
      },
    })
  }
  const rows = await redditCandidates(
    "id",
    "secret",
    "app",
    "Tekken 8,GTA 6".split(","),
    "",
    mock,
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].comments, 3)
  assert.equal("selftext" in rows[0], false)
})
test("transient limits back off and daily quota exhaustion stops immediately", async () => {
  const delays: number[] = []
  let attempts = 0
  const result = await retryRead(
    async () => {
      if (++attempts < 3) throw new ProviderError(429, "")
      return "ok"
    },
    async (value) => {
      delays.push(value)
    },
  )
  assert.equal(result, "ok")
  assert.deepEqual(delays, [500, 1000])
  await assert.rejects(
    () =>
      retryRead(
        async () => {
          throw new ProviderError(403, "quotaExceeded")
        },
        async () => assert.fail("must not retry"),
      ),
    /quotaExceeded/,
  )
})
