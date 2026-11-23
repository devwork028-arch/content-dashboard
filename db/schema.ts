import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core"

export const records = pgTable(
  "records",
  {
    kind: text().notNull(),
    id: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    revision: integer().notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.kind, table.id] })],
)
