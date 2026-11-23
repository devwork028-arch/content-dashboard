"use client"
import { useEffect, useState } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  BarChart,
  Bar,
} from "recharts"
import type { Snapshot, Report } from "@/lib/insights"
import { api } from "@/lib/http"
import { Panel, Notice, message, formatDate } from "./common"
import { Button } from "./ui/button"
type Metric = Report[number]
const sum = (items: Report, key: string) =>
  items.reduce((s, r) => s + Number(r[key] ?? 0), 0)
const num = (n: number) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: 1 })
const slot = (v: Metric) =>
  v.publishedAt
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        hour: "2-digit",
      }).format(new Date(v.publishedAt))
    : "Unknown"
function Curve({ video, days }: { video: Metric; days: number }) {
  const [points, setPoints] = useState<{ sec: number; retention: number }[]>(
      [],
    ),
    [status, setStatus] = useState("")
  useEffect(() => {
    let active = true
    setPoints([])
    setStatus("Loading retention…")
    api<{ points: Report }>(
      "insights/retention/" + video.video + "?days=" + days,
    )
      .then((data) => {
        if (active) {
          setPoints(
            data.points.map((p) => ({
              sec:
                Number(p.elapsedVideoTimeRatio) * Number(video.duration ?? 0),
              retention: Number(p.audienceWatchRatio) * 100,
            })),
          )
          setStatus(
            data.points.length ? "" : "Retention unavailable for this video.",
          )
        }
      })
      .catch((e) => active && setStatus(message(e)))
    return () => {
      active = false
    }
  }, [video, days])
  const drop = points
    .slice(1)
    .map((p, i) => ({ sec: p.sec, change: points[i].retention - p.retention }))
    .sort((a, b) => b.change - a.change)[0]
  return (
    <>
      <Notice text={status} />
      {points.length > 0 && (
        <>
          <p className="muted">
            First 3 seconds shaded.{" "}
            {drop?.change > 0
              ? "Largest drop at " +
                num(drop.sec) +
                " seconds (" +
                num(drop.change) +
                " percentage points)."
              : ""}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={points}>
              <XAxis type="number" dataKey="sec" unit="s" />
              <YAxis unit="%" />
              <Tooltip />
              <ReferenceArea x1={0} x2={3} fill="#bef264" fillOpacity={0.25} />
              {drop?.change > 0 && (
                <ReferenceLine x={drop.sec} stroke="#fb7185" />
              )}
              <Line dataKey="retention" stroke="#bef264" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </>
  )
}
function Rank({ rows, field }: { rows: Report; field: string }) {
  return (
    <>
      {[...rows]
        .sort((a, b) => Number(b.views) - Number(a.views))
        .slice(0, 10)
        .map((r) => (
          <p className="flex justify-between text-sm" key={String(r[field])}>
            <span>{String(r[field])}</span>
            <span>{num(Number(r.views))}</span>
          </p>
        ))}
    </>
  )
}
export function YouTubeAnalytics({ compact = false }: { compact?: boolean }) {
  const [days, setDays] = useState(7),
    [data, setData] = useState<Snapshot>(),
    [status, setStatus] = useState(""),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false)
  const [first, setFirst] = useState(""),
    [second, setSecond] = useState("")
  useEffect(() => {
    let active = true
    setData(undefined)
    setStatus("Loading…")
    api<Snapshot & { empty?: boolean }>("insights/" + days)
      .then((value) => {
        if (active) {
          setData(value.empty ? undefined : value)
          setStatus(
            value.empty ? "Connect YouTube in Settings and sync insights." : "",
          )
        }
      })
      .catch((e) => active && setStatus(message(e)))
    return () => {
      active = false
    }
  }, [days, refresh])
  const videos = data?.videos ?? []
  const selections = [
    videos.find((v) => v.video === first) ?? videos[0],
    videos.find((v) => v.video === second) ?? videos[1],
  ]
  const hours = new Map<string, { views: number; count: number }>()
  for (const v of videos) {
    const k = slot(v),
      prev = hours.get(k) ?? { views: 0, count: 0 }
    hours.set(k, { views: prev.views + Number(v.views), count: prev.count + 1 })
  }
  const bestTime = [...hours.entries()].sort(
    ([, a], [, b]) => b.views / b.count - a.views / a.count,
  )[0]
  const bestHook = videos
    .filter((v) => v.hookRetention !== undefined)
    .sort((a, b) => Number(b.hookRetention) - Number(a.hookRetention))[0]
  return (
    <>
      <Panel title="YouTube snapshot">
        <div className="flex flex-wrap gap-2">
          {[7, 28, 90].map((n) => (
            <Button
              key={n}
              variant={days === n ? "default" : "outline"}
              onClick={() => setDays(n)}
            >
              {n} days
            </Button>
          ))}
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const result = await api<{ connected?: boolean }>(
                  "insights/sync",
                  {},
                )
                if (result.connected === false)
                  setStatus("Connect YouTube in Settings.")
                else setRefresh((n) => n + 1)
              } catch (e) {
                setStatus(message(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? "Syncing…" : "Sync insights"}
          </Button>
        </div>
        <Notice text={status} />
        {data && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Views", "views"],
                ["Watch minutes", "estimatedMinutesWatched"],
                ["Subs gained", "subscribersGained"],
              ].map(([label, key]) => (
                <div key={key}>
                  <b className="text-xl">{num(sum(data.daily, key))}</b>
                  <p className="muted">{label}</p>
                </div>
              ))}
            </div>
            <p className="muted">
              Last synced {formatDate(data.at)}. Recent data may be incomplete.
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.daily}>
                <XAxis dataKey="day" minTickGap={30} />
                <YAxis width={48} />
                <Tooltip />
                <Line dataKey="views" stroke="#bef264" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </Panel>
      {data && !compact && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Top 10 videos">
              <Rank rows={videos} field="title" />
            </Panel>
            <Panel title="Views by format">
              <Rank rows={data.formats} field="creatorContentType" />
            </Panel>
            <Panel title="What to repeat">
              <p>
                Review the opening of <b>{String(bestHook?.title ?? "—")}</b>.
                Measured retention around 3 seconds ·{" "}
                {bestHook
                  ? num(Number(bestHook.hookRetention)) + "%"
                  : "unavailable"}
                .
              </p>
              <p>Highest-viewed title · {String(videos[0]?.title ?? "—")}</p>
              <p>
                Highest average views by publish slot ·{" "}
                {bestTime
                  ? bestTime[0] + " IST (" + bestTime[1].count + " videos)"
                  : "—"}
              </p>
            </Panel>
            {(
              [
                ["Traffic sources", data.traffic, "insightTrafficSourceType"],
                ["Top geographies", data.countries, "country"],
                ["Devices", data.devices, "deviceType"],
              ] as const
            ).map(([label, rows, field]) => (
              <Panel title={label} key={field}>
                <Rank rows={rows} field={field} />
              </Panel>
            ))}
          </div>
          <h2>Compare videos</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {selections.map(
              (v, i) =>
                v && (
                  <Panel title={"Video " + (i + 1)} key={i}>
                    <select
                      aria-label={"Compare video " + (i + 1)}
                      value={v.video}
                      onChange={(e) =>
                        (i ? setSecond : setFirst)(e.target.value)
                      }
                    >
                      {videos.map((row) => (
                        <option key={row.video} value={row.video}>
                          {row.title ?? row.video}
                        </option>
                      ))}
                    </select>
                    <dl className="grid grid-cols-2 gap-1 text-sm">
                      {[
                        "views",
                        "estimatedMinutesWatched",
                        "averageViewDuration",
                        "averageViewPercentage",
                        "subscribersGained",
                        "likes",
                        "comments",
                        "shares",
                      ].map((key) => (
                        <div key={key}>
                          <dt className="text-zinc-400">
                            {key.replace(/([A-Z])/g, " $1")}
                          </dt>
                          <dd>{num(Number(v[key] ?? 0))}</dd>
                        </div>
                      ))}
                    </dl>
                    <Curve video={v} days={days} />
                  </Panel>
                ),
            )}
          </div>
        </>
      )}
    </>
  )
}
export function WeeklyChart({
  data,
}: {
  data: { week: string; views: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="week" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="views" fill="#bef264" />
      </BarChart>
    </ResponsiveContainer>
  )
}
