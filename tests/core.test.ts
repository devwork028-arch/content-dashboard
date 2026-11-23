import { test } from "node:test"
import assert from "node:assert/strict"
import { PGlite } from "@electric-sql/pglite"
import { readFile } from "node:fs/promises"
import { emptyMetadata, models } from "../lib/models"

test("initial migration applies to PostgreSQL and enforces record identity", async () => {
  const pg = new PGlite()
  try {
    const journal = JSON.parse(
      await readFile("db/migrations/meta/_journal.json", "utf8"),
    )
    for (const entry of journal.entries)
      await pg.exec(
        (
          await readFile("db/migrations/" + entry.tag + ".sql", "utf8")
        ).replaceAll("--> statement-breakpoint", ""),
      )
    await pg.query(
      "insert into records(kind,id,data) values('script','s','{}')",
    )
    await assert.rejects(
      () =>
        pg.query("insert into records(kind,id,data) values('script','s','{}')"),
      /duplicate key/,
    )
  } finally {
    await pg.close()
  }
})
test("metadata limits and valid Instagram hashtag counts", () => {
  assert.equal(
    models.metadata.safeParse({
      ...emptyMetadata,
      youtubeTitle: "a".repeat(61),
    }).success,
    false,
  )
  assert.equal(
    models.metadata.safeParse({
      ...emptyMetadata,
      instagramHashtags: "#a #b #c #d",
    }).success,
    true,
  )
  assert.equal(
    models.metadata.safeParse({ ...emptyMetadata, x: "a".repeat(281) }).success,
    false,
  )
})
