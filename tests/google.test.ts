import { test } from "node:test"
import assert from "node:assert/strict"
import { exchange, seal, unseal } from "../lib/google"
import { confirmPlan, diff, inverse } from "../lib/edits"
import { provider, retryRead } from "../lib/provider"
test("Google refresh uses form grant and encrypted tokens round trip", async () => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64")
  const encrypted = seal("fake-refresh")
  assert.ok(!encrypted.includes("fake-refresh"))
  const token = await exchange(
    { grant_type: "refresh_token", refresh_token: unseal(encrypted) },
    async (url, options) => {
      assert.equal(String(url), "https://oauth2.googleapis.com/token")
      assert.equal(
        (options!.body as URLSearchParams).get("refresh_token"),
        "fake-refresh",
      )
      return Response.json({ access_token: "mock-access" })
    },
  )
  assert.equal(token.access_token, "mock-access")
})
test("metadata preview, confirm, stale check and inverse against mocked Google", async () => {
  const plan = {
    video: "test",
    kind: "metadata" as const,
    before: { title: "old" },
    after: { title: "new" },
  }
  let remote = { title: "old" }
  const google: typeof fetch = async (_url, init) => {
    remote = JSON.parse(String(init?.body))
    return Response.json(remote)
  }
  const push = (p: typeof plan, confirm: boolean) =>
    confirmPlan(p, remote, confirm, async () => {
      await provider(
        "https://example.test/videos",
        { method: "PUT", body: JSON.stringify(p.after) },
        google,
      )
    })
  assert.deepEqual(diff(plan.before, plan.after), [
    { key: "title", before: "old", after: "new" },
  ])
  await assert.rejects(() => push(plan, false), /Confirmation/)
  assert.equal(remote.title, "old")
  await push(plan, true)
  assert.equal(remote.title, "new")
  await assert.rejects(() => push(plan, true), /changed/)
  await push(inverse(plan) as typeof plan, true)
  assert.equal(remote.title, "old")
})
test("Google quota response stops the sync without repeated calls", async () => {
  let count = 0
  await assert.rejects(
    () =>
      retryRead(() =>
        provider("https://example.test", {}, async () => {
          count++
          return Response.json(
            { error: { errors: [{ reason: "quotaExceeded" }] } },
            { status: 403 },
          )
        }),
      ),
    /quotaExceeded/,
  )
  assert.equal(count, 1)
})
