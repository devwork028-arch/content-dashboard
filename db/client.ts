import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"
function connect() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.")
  return drizzle(
    postgres(process.env.DATABASE_URL, { max: 2, prepare: false }),
    { schema },
  )
}
let database: ReturnType<typeof connect> | undefined
export function db() {
  return (database ??= connect())
}
