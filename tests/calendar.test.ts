import { test } from "node:test"
import assert from "node:assert/strict"
import { calendarDays, fromIst, istDay, istInput } from "../lib/calendar"
test("IST dates cross the UTC boundary and calendar weeks start on Monday", () => {
  const at = fromIst("2026-11-23T00:30")
  assert.equal(at, "2026-11-22T19:00:00.000Z")
  assert.equal(istDay(new Date(at)), "2026-11-23")
  assert.equal(istInput(at), "2026-11-23T00:30")
  assert.equal(calendarDays("2026-11-25", false)[0], "2026-11-23")
  assert.equal(calendarDays("2026-11-25", true).length, 42)
})
