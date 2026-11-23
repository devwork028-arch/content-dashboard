"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/http"
import { useRows, Panel, Notice, message, formatDate } from "./common"
import { Button } from "./ui/button"
import { CsvImport } from "./planning"
import { WeeklyChart } from "./analytics"
import { calendarDays, istDay } from "@/lib/calendar"
export function InstagramConnection() {
  const [info, setInfo] = useState<{
      connected: boolean
      configured: boolean
      sync?: string
    }>(),
    [status, setStatus] = useState("")
  const reload = () =>
    api<{ connected: boolean; configured: boolean; sync?: string }>(
      "instagram/status",
    ).then(setInfo)
  useEffect(() => {
    void reload().catch((e) => setStatus(message(e)))
  }, [])
  return (
    <Panel title="Instagram connection">
      <p className="muted">
        {info?.connected
          ? "Owner Page connected"
          : info?.configured
            ? "Owner Page credentials configured"
            : "Configure your Meta Page credentials to connect"}{" "}
        · Last synced {formatDate(info?.sync)}
      </p>
      <Button
        variant="outline"
        onClick={async () => {
          try {
            await api(
              "instagram/" + (info?.connected ? "disconnect" : "connect"),
              {},
            )
            await reload()
            setStatus("")
          } catch (e) {
            setStatus(message(e))
          }
        }}
      >
        {info?.connected ? "Disconnect Instagram" : "Connect Instagram"}
      </Button>
      <Notice text={status} />
    </Panel>
  )
}
export function SocialAnalytics({ platform }: { platform: "Instagram" | "X" }) {
  const x = platform === "X"
  const rows = useRows(x ? "x" : "reel")
  const [status, setStatus] = useState(""),
    [week, setWeek] = useState("")
  const byWeek = new Map<string, number>()
  const points = rows.rows.map((r) => {
    const day = x ? String(r.data.date) : istDay(new Date(String(r.data.date)))
    const key = calendarDays(day, false)[0]
    byWeek.set(key, (byWeek.get(key) ?? 0) + Number(r.data.views ?? 0))
    return { ...r, week: key }
  })
  const weeks = [...byWeek.keys()].sort(),
    selected = week || weeks.at(-1)
  const ranked = points
    .filter((p) => p.week === selected)
    .sort((a, b) => Number(b.data.views) - Number(a.data.views))
    .slice(0, 10)
  return (
    <Panel title={platform + " analytics"}>
      {x ? (
        <>
          <CsvImport kind="x" onDone={rows.reload} />
          <p className="muted">
            Import a post-level X export with post text, date and impressions.
            Reimporting the same post and date updates its totals.
          </p>
        </>
      ) : (
        <Button
          variant="outline"
          onClick={async () => {
            try {
              setStatus("Syncing Reels…")
              await api("instagram/sync", {})
              await rows.reload()
              setStatus("Reels synced.")
            } catch (e) {
              setStatus(message(e))
            }
          }}
        >
          Sync own Reels
        </Button>
      )}
      <Notice text={status || rows.error} />
      {weeks.length ? (
        <>
          <p className="muted">
            {x ? "Impressions" : "Lifetime Reel views"} grouped by post week.
          </p>
          <WeeklyChart
            data={weeks.map((week) => ({ week, views: byWeek.get(week)! }))}
          />
          <label>
            Top posts for week starting
            <select value={selected} onChange={(e) => setWeek(e.target.value)}>
              {weeks.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </label>
          {ranked.map((r, i) => (
            <div key={r.id} className="border-t border-zinc-800 pt-2">
              {x ? (
                <p>{String(r.data.post)}</p>
              ) : (
                <a className="underline" href={String(r.data.link)}>
                  Reel {i + 1} · {formatDate(r.data.date)}
                </a>
              )}
              <p className="muted">
                {(x
                  ? ["views", "likes", "replies", "reposts"]
                  : ["views", "reach", "saved", "shares"]
                )
                  .map(
                    (k) =>
                      (x && k === "views" ? "impressions" : k) +
                      " " +
                      String(r.data[k] ?? "—"),
                  )
                  .join(" · ")}
              </p>
            </div>
          ))}
        </>
      ) : (
        <p className="muted">
          {x
            ? "Import a CSV to see X activity."
            : "Connect your professional account and sync Reels."}
        </p>
      )}
    </Panel>
  )
}
