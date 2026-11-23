"use client"
import { useState } from "react"
import Link from "next/link"
import { YouTubeAnalytics } from "./analytics"
import { Panel, Notice, formatDate, useRows, message } from "./common"
import { useResearch } from "./research"
import { calendarDays, istDay } from "@/lib/calendar"
import { games } from "@/lib/models"
import { Button } from "./ui/button"
import { api } from "@/lib/http"

export function Overview() {
  const scripts = useRows("script")
  const kits = useRows("metadata")
  const calendar = useRows("calendar")
  const research = useResearch()
  const monday = calendarDays(istDay(new Date()), false)[0]
  const topics = research.result.topics
    .filter(
      (row) =>
        istDay(new Date(String(row.data.published))) >= monday &&
        row.data.status !== "dropped",
    )
    .sort((a, b) => Number(b.data.score) - Number(a.data.score))
    .slice(0, 5)
  const posts = calendar.rows
    .filter(
      (row) =>
        Date.parse(String(row.data.at)) >= Date.now() &&
        row.data.status !== "posted",
    )
    .sort((a, b) => String(a.data.at).localeCompare(String(b.data.at)))
    .slice(0, 6)
  const edits = [...scripts.rows, ...kits.rows]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 6)
  return (
    <>
      <p className="muted">
        majdoorGamerz · Week of {monday} · India Standard Time
      </p>
      <Notice
        text={scripts.error || kits.error || calendar.error || research.status}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="This week’s research">
          {topics.map((row) => (
            <Link
              key={row.id}
              href="/research"
              className="flex justify-between gap-4"
            >
              <span>{String(row.data.title)}</span>
              <b className="text-lime-300">{String(row.data.score)}</b>
            </Link>
          ))}
          {!topics.length && (
            <Link href="/research" className="muted underline">
              Open Research to refresh topic briefs
            </Link>
          )}
        </Panel>
        <Panel title="Upcoming posts">
          {posts.map((row) => (
            <Link key={row.id} href="/calendar">
              <strong>{String(row.data.title)}</strong>
              <p className="muted">
                {formatDate(row.data.at)} · {String(row.data.platform)} ·{" "}
                {String(row.data.status)}
              </p>
            </Link>
          ))}
          {!posts.length && (
            <Link href="/calendar" className="muted underline">
              Plan your first post in Calendar
            </Link>
          )}
        </Panel>
        <Panel title="Recent edits">
          {edits.map((row) => (
            <Link
              key={row.kind + row.id}
              href={row.kind === "script" ? "/studio" : "/metadata"}
            >
              <strong>
                {String(
                  row.data.title ??
                    scripts.rows.find((script) => script.id === row.id)?.data
                      .title ??
                    "Metadata kit",
                )}
              </strong>
              <p className="muted">
                {row.kind} · {formatDate(row.updatedAt)}
              </p>
            </Link>
          ))}
          {!edits.length && (
            <Link href="/studio" className="muted underline">
              Start a draft in Script Studio
            </Link>
          )}
        </Panel>
        <YouTubeAnalytics compact />
      </div>
    </>
  )
}

export function Preferences() {
  const settings = useRows("settings")
  const current = settings.rows.find((row) => row.id === "owner")
  const [status, setStatus] = useState("")
  return (
    <Panel title="Research preferences">
      {!settings.loading && (
        <form
          key={current?.revision ?? 0}
          className="grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            try {
              await api("save/settings/owner", {
                revision: current?.revision ?? 0,
                data: {
                  games: String(form.get("games"))
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                  keywords: String(form.get("keywords")),
                },
              })
              await settings.reload()
              setStatus("Preferences saved.")
            } catch (error) {
              setStatus(message(error))
            }
          }}
        >
          <label>
            Games, separated by commas
            <input
              name="games"
              required
              defaultValue={(
                (current?.data.games as string[] | undefined) ?? games
              ).join(", ")}
            />
          </label>
          <label>
            Niche keywords, separated by commas
            <textarea
              name="keywords"
              defaultValue={String(
                current?.data.keywords ?? "gaming comedy, ranked, matchmaking",
              )}
            />
          </label>
          <Button>Save preferences</Button>
        </form>
      )}
      <Notice text={status || settings.error} />
    </Panel>
  )
}
