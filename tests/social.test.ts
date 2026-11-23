import { test } from "node:test"
import assert from "node:assert/strict"
import { models } from "../lib/models"
import { calendarDays } from "../lib/calendar"
test("X post metrics accept exported counts and group Sundays with the previous Monday", () => {
  const result = models.x.parse({
    post: "Sample clip",
    date: "2026-11-22",
    views: "1000",
    likes: "10",
    reposts: "2",
    replies: "3",
  })
  assert.equal(result.views, 1000)
  assert.equal(calendarDays(result.date, false)[0], "2026-11-16")
  assert.ok(!models.x.safeParse({ ...result, views: -1 }).success)
})
