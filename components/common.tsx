"use client"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { api } from "@/lib/http"
import type { Row } from "@/lib/models"
export function useRows(kind: string, id = "") {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await api<Row[]>("list/" + kind + (id ? "/" + id : "")))
      setError("")
    } catch (err) {
      setError(message(err))
    } finally {
      setLoading(false)
    }
  }, [kind, id])
  useEffect(() => {
    void reload()
  }, [reload])
  return { rows, error, loading, reload }
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : "Request failed."
}
export function Notice({ text }: { text: string }) {
  return text ? (
    <p role="status" className="text-sm text-lime-200">
      {text}
    </p>
  ) : null
}
export function Panel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="panel grid content-start gap-3">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
export const ist = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
})
export function formatDate(value: unknown) {
  return value && Number.isFinite(Date.parse(String(value)))
    ? ist.format(new Date(String(value))) + " IST"
    : "—"
}
