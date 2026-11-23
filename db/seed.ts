import { loadEnvConfig } from "@next/env"
import { db } from "./client"
import { records } from "./schema"
import { emptyMetadata } from "../lib/models"
loadEnvConfig(process.cwd())
async function seed() {
  const script = {
    title: "Practice room excuses · sample",
    body: "",
    format: "trio",
    roles: ["Player learning a matchup", "Training partner", "Spectator"],
  }
  await db().transaction(async (tx) => {
    await tx
      .insert(records)
      .values([
        { kind: "script", id: "sample-tekken", data: script },
        {
          kind: "version",
          id: "sample-tekken:1",
          data: { scriptId: "sample-tekken", revision: 1, snapshot: script },
        },
        { kind: "metadata", id: "sample-tekken", data: emptyMetadata },
        {
          kind: "calendar",
          id: "sample-practice",
          data: {
            title: "Practice room skit · sample",
            platform: "YouTube",
            status: "idea",
            at: new Date(Date.now() + 86400000).toISOString(),
          },
        },
      ])
      .onConflictDoNothing()
  })
}
seed()
  .then(() => process.exit(0))
  .catch(() => {
    console.error("Seed failed. Check DATABASE_URL and apply the migration.")
    process.exit(1)
  })
