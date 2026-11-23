import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { records } from "@/db/schema"
import type { Data } from "./models"

export const where = (kind: string, id: string) =>
  and(eq(records.kind, kind), eq(records.id, id))
export async function get(kind: string, id: string) {
  return (await db().select().from(records).where(where(kind, id)))[0]
}
export function list(kind: string) {
  return db()
    .select()
    .from(records)
    .where(eq(records.kind, kind))
    .orderBy(desc(records.updatedAt))
    .limit(1500)
}
export async function save(
  kind: string,
  id: string,
  data: Data,
  expected?: number,
) {
  return db().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${kind + ":" + id},0))`,
    )
    const [previous] = await tx.select().from(records).where(where(kind, id))
    if (expected !== undefined && expected !== (previous?.revision ?? 0))
      throw new Error("This record changed. Reload before saving again.")
    if (previous && JSON.stringify(previous.data) === JSON.stringify(data))
      return previous
    const revision = (previous?.revision ?? 0) + 1
    const updatedAt = new Date().toISOString()
    const [saved] = await tx
      .insert(records)
      .values({ kind, id, data, revision, updatedAt })
      .onConflictDoUpdate({
        target: [records.kind, records.id],
        set: { data, revision, updatedAt },
      })
      .returning()
    if (kind === "script")
      await tx
        .insert(records)
        .values({
          kind: "version",
          id: id + ":" + revision,
          data: { scriptId: id, revision, snapshot: data },
          updatedAt,
        })
    return saved
  })
}
export async function remove(kind: string, id: string) {
  await db().delete(records).where(where(kind, id))
}
export async function importRows(
  kind: string,
  rows: { id: string; data: Data }[],
) {
  if (!rows.length) return
  await db().transaction(async (tx) => {
    for (const row of rows) {
      await tx
        .insert(records)
        .values({ kind, ...row })
        .onConflictDoUpdate({
          target: [records.kind, records.id],
          set: {
            data: row.data,
            updatedAt: sql`now()`,
            revision: sql`${records.revision}+1`,
          },
        })
    }
  })
}
