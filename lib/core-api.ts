import { z } from "zod"
import { models, type Kind } from "./models"
import { get, list, save, remove, importRows } from "./store"
import { idSchema } from "./http"
import { createHash } from "node:crypto"
import Papa from "papaparse"

export async function core(
  request: Request,
  action: string,
  kind: string,
  id: string,
) {
  if (action === "list" && request.method === "GET") {
    if (Object.hasOwn(models, kind)) return list(kind)
    if (kind === "version")
      return (await list(kind)).filter(
        (row) => row.data.scriptId === idSchema.parse(id),
      )
  }
  if (
    action === "save" &&
    request.method === "POST" &&
    Object.hasOwn(models, kind)
  ) {
    const value = z
      .object({
        data: models[kind as Kind],
        revision: z.number().int().min(0).optional(),
      })
      .parse(await request.json())
    if (kind === "metadata" && !(await get("script", id)))
      throw new Error("Open a script before saving metadata.")
    return save(kind, idSchema.parse(id), value.data, value.revision)
  }
  if (
    action === "remove" &&
    request.method === "POST" &&
    ["calendar", "competitor", "x"].includes(kind)
  ) {
    await remove(kind, idSchema.parse(id))
    return { ok: true }
  }
  if (
    action === "import" &&
    request.method === "POST" &&
    (kind === "competitor" || kind === "x")
  ) {
    const { csv } = z
      .object({ csv: z.string().max(800000) })
      .parse(await request.json())
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: "greedy",
    })
    if (
      parsed.errors.length ||
      !parsed.data.length ||
      parsed.data.length > 1500
    )
      throw new Error("Use a CSV with a header and 1–1500 valid rows.")
    const rows = parsed.data.map((row, index) => {
      const columns = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key.trim().toLowerCase(),
          value,
        ]),
      )
      const input =
        kind === "x"
          ? {
              post:
                columns.post ??
                columns["post text"] ??
                columns["tweet text"] ??
                columns["post id"] ??
                columns["tweet id"],
              date: (columns.date ?? columns.time ?? "").slice(0, 10),
              views: columns.views ?? columns.impressions,
              likes: columns.likes || 0,
              replies: columns.replies || 0,
              reposts: columns.reposts || columns.retweets || 0,
            }
          : row
      const result = models[kind].safeParse(input)
      if (!result.success)
        throw new Error(
          "CSV row " +
            (index + 2) +
            ": " +
            result.error.issues
              .map((issue) => issue.path.join(".") + " " + issue.message)
              .join(", "),
        )
      return {
        id: createHash("sha256")
          .update(
            kind === "x"
              ? JSON.stringify([
                  columns["post id"] ??
                    columns["tweet id"] ??
                    (result.data as z.infer<typeof models.x>).post,
                  (result.data as z.infer<typeof models.x>).date,
                ])
              : String(row.link),
          )
          .digest("hex"),
        data: result.data,
      }
    })
    await importRows(kind, [
      ...new Map(rows.map((row) => [row.id, row])).values(),
    ])
    return { count: rows.length }
  }
}
