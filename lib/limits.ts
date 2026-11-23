import { sql } from "drizzle-orm"
import { db } from "@/db/client"
import { records } from "@/db/schema"
import { where } from "./store"

export async function budget(
  key: string,
  cost: number,
  limit: number,
  period: number,
) {
  return db().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"budget:" + key},0))`,
    )
    const [row] = await tx.select().from(records).where(where("budget", key))
    const now = Date.now()
    const periodStart =
      period === 86400000
        ? Date.parse(
            new Date(now).toLocaleDateString("en-CA", {
              timeZone: "America/Los_Angeles",
            }) + "T00:00:00Z",
          )
        : Math.floor(now / period) * period
    const used =
      row?.data.periodStart === periodStart ? Number(row.data.used) : 0
    if (used + cost > limit)
      return { ok: false, remaining: Math.max(0, limit - used) }
    if (cost) {
      const data = { periodStart, used: used + cost }
      await tx
        .insert(records)
        .values({ kind: "budget", id: key, data })
        .onConflictDoUpdate({
          target: [records.kind, records.id],
          set: { data },
        })
    }
    return { ok: true, remaining: limit - used - cost }
  })
}
