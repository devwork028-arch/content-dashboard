"use client"
import { useState, type FormEvent } from "react"
import Papa from "papaparse"
import { Button } from "./ui/button"
import { Notice, Panel, formatDate, message, useRows } from "./common"
import { api } from "@/lib/http"
import { platforms, statuses, type Row } from "@/lib/models"
import {
  calendarDays,
  fromIst,
  istDay,
  istInput,
  shiftDay,
} from "@/lib/calendar"

export function Calendar() {
  const posts = useRows("calendar")
  const [anchor, setAnchor] = useState(() => istDay(new Date()))
  const [month, setMonth] = useState(false)
  const [editing, setEditing] = useState<Row>()
  const [status, setStatus] = useState("")
  const [dragging, setDragging] = useState("")
  const days = calendarDays(anchor, month)
  async function save(data: Record<string, unknown>, row?: Row) {
    try {
      await api("save/calendar/" + (row?.id ?? crypto.randomUUID()), {
        data,
        revision: row?.revision ?? 0,
      })
      setStatus("Post saved.")
      setEditing(undefined)
      await posts.reload()
    } catch (error) {
      setStatus(message(error))
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void save(
      {
        title: form.get("title"),
        platform: form.get("platform"),
        status: form.get("status"),
        at: fromIst(String(form.get("at"))),
      },
      editing,
    )
  }
  function navigate(offset: number) {
    if (!month) {
      setAnchor(shiftDay(anchor, offset * 7))
      return
    }
    const date = new Date(anchor.slice(0, 7) + "-01T12:00:00Z")
    date.setUTCMonth(date.getUTCMonth() + offset)
    setAnchor(date.toISOString().slice(0, 10))
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Previous
        </Button>
        <Button variant="outline" onClick={() => navigate(1)}>
          Next
        </Button>
        <Button variant="outline" onClick={() => setAnchor(istDay(new Date()))}>
          Today
        </Button>
        <Button
          variant={month ? "outline" : "default"}
          onClick={() => setMonth(false)}
        >
          Week
        </Button>
        <Button
          variant={month ? "default" : "outline"}
          onClick={() => setMonth(true)}
        >
          Month
        </Button>
        <span className="muted">
          {month ? anchor.slice(0, 7) : days[0] + " to " + days[6]} · IST
        </span>
      </div>
      <Notice text={status || posts.error} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => (
          <div
            key={day}
            className="min-h-24 rounded-lg border border-zinc-800 bg-[#191b1d] p-2"
            onDragOver={(event) => {
              if (dragging) event.preventDefault()
            }}
            onDrop={(event) => {
              event.preventDefault()
              const row = posts.rows.find((post) => post.id === dragging)
              setDragging("")
              if (row)
                void save(
                  {
                    ...row.data,
                    at: fromIst(day + istInput(String(row.data.at)).slice(10)),
                  },
                  row,
                )
            }}
          >
            <p className="mb-2 text-xs text-zinc-400">
              {new Intl.DateTimeFormat("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              }).format(new Date(day + "T12:00Z"))}
            </p>
            {posts.rows
              .filter((row) => istDay(new Date(String(row.data.at))) === day)
              .sort((a, b) =>
                String(a.data.at).localeCompare(String(b.data.at)),
              )
              .map((row) => (
                <button
                  key={row.id}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", row.id)
                    setDragging(row.id)
                  }}
                  onDragEnd={() => setDragging("")}
                  onClick={() => setEditing(row)}
                  className="mb-2 grid w-full gap-1 rounded border border-zinc-700 bg-zinc-900 p-2 text-left text-xs hover:border-lime-300"
                >
                  <strong className="break-words">
                    {String(row.data.title)}
                  </strong>
                  <span className="text-lime-300">
                    {String(row.data.platform)}
                  </span>
                  <span>
                    {istInput(String(row.data.at)).slice(11)} ·{" "}
                    {String(row.data.status)}
                  </span>
                </button>
              ))}
          </div>
        ))}
      </div>
      <Panel title={editing ? "Edit post" : "Add a post"}>
        <form
          key={editing?.id ?? anchor}
          onSubmit={submit}
          className="grid items-end gap-3 md:grid-cols-4"
        >
          <label>
            Title
            <input
              name="title"
              defaultValue={String(editing?.data.title ?? "")}
              required
              maxLength={300}
            />
          </label>
          <label>
            Platform
            <select
              name="platform"
              defaultValue={String(editing?.data.platform ?? "YouTube")}
            >
              {platforms.map((platform) => (
                <option key={platform}>{platform}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              name="status"
              defaultValue={String(editing?.data.status ?? "idea")}
            >
              {statuses.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Date and time (IST)
            <input
              name="at"
              type="datetime-local"
              defaultValue={
                editing ? istInput(String(editing.data.at)) : anchor + "T18:00"
              }
              required
            />
          </label>
          <Button>{editing ? "Save post" : "Add post"}</Button>
          {editing && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(undefined)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await api("remove/calendar/" + editing.id, {})
                    setEditing(undefined)
                    await posts.reload()
                  } catch (error) {
                    setStatus(message(error))
                  }
                }}
              >
                Remove post
              </Button>
            </>
          )}
        </form>
      </Panel>
    </>
  )
}

export function CsvImport({
  kind,
  onDone,
}: {
  kind: "competitor" | "x"
  onDone: () => Promise<void>
}) {
  const [status, setStatus] = useState("")
  return (
    <div className="grid max-w-md gap-2">
      <label>
        Import CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (event) => {
            const input = event.currentTarget
            const file = input.files?.[0]
            if (!file) return
            try {
              if (file.size > 800000)
                throw new Error("Select a CSV smaller than 800 KB.")
              const result = await api<{ count: number }>("import/" + kind, {
                csv: await file.text(),
              })
              setStatus(result.count + " rows imported.")
              await onDone()
            } catch (error) {
              setStatus(message(error))
            } finally {
              input.value = ""
            }
          }}
        />
      </label>
      <Notice text={status} />
    </div>
  )
}
const columns = {
  creator: "Creator",
  platform: "Platform",
  link: "Link",
  hook: "Hook",
  format: "Format",
  length: "Length (seconds)",
  views: "Views",
  reason: "Why it worked",
}
export function Competitors() {
  const entries = useRows("competitor")
  const [status, setStatus] = useState("")
  const [editing, setEditing] = useState<Row>()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    try {
      await api("save/competitor/" + (editing?.id ?? crypto.randomUUID()), {
        data: Object.fromEntries(new FormData(form)),
        revision: editing?.revision ?? 0,
      })
      setStatus("Entry saved.")
      form.reset()
      setEditing(undefined)
      await entries.reload()
    } catch (error) {
      setStatus(message(error))
    }
  }
  function download() {
    const fields = Object.keys(columns)
    const csv = Papa.unparse(
      {
        fields,
        data: entries.rows.map((row) =>
          fields.map((field) => row.data[field] ?? ""),
        ),
      },
      { escapeFormulae: true },
    )
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "competitor-tracker.csv"
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <>
      <Panel title={editing ? "Edit observation" : "Add an observation"}>
        <form
          key={editing?.id ?? "new"}
          onSubmit={submit}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {Object.entries(columns).map(([key, label]) => (
            <label key={key}>
              {label}
              {key === "platform" ? (
                <select
                  name={key}
                  defaultValue={String(editing?.data[key] ?? "YouTube")}
                >
                  {platforms.map((platform) => (
                    <option key={platform}>{platform}</option>
                  ))}
                </select>
              ) : (
                <input
                  name={key}
                  defaultValue={String(editing?.data[key] ?? "")}
                  type={
                    key === "link"
                      ? "url"
                      : key === "views" || key === "length"
                        ? "number"
                        : "text"
                  }
                  min={0}
                  required={["creator", "link", "views", "length"].includes(
                    key,
                  )}
                />
              )}
            </label>
          ))}
          <Button>{editing ? "Save changes" : "Add entry"}</Button>
          {editing && (
            <Button
              variant="outline"
              type="button"
              onClick={() => setEditing(undefined)}
            >
              Cancel
            </Button>
          )}
        </form>
        <Notice text={status || entries.error} />
      </Panel>
      <div className="flex flex-wrap items-start gap-4">
        <CsvImport kind="competitor" onDone={entries.reload} />
        <Button variant="outline" onClick={download}>
          Export CSV
        </Button>
      </div>
      <Panel title="Observations">
        {entries.rows.length === 0 ? (
          <p className="muted">No observations yet. Add one or import a CSV.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {Object.values(columns).map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.rows.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-800">
                    {Object.keys(columns).map((key) => (
                      <td key={key}>
                        {key === "link" ? (
                          <a
                            className="underline"
                            href={String(row.data.link)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                        ) : (
                          String(row.data[key])
                        )}
                      </td>
                    ))}
                    <td>
                      <Button variant="outline" onClick={() => setEditing(row)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await api("remove/competitor/" + row.id, {})
                            await entries.reload()
                          } catch (error) {
                            setStatus(message(error))
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
