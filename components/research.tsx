"use client"
import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/http"
import { topicStatuses, type Row } from "@/lib/models"
import { scoreFormula } from "@/lib/models"
import { Button } from "./ui/button"
import { Notice, Panel, formatDate, message } from "./common"

export type ResearchResult = {
  topics: Row[]
  sync?: { at: string; count: number; warnings: string[] }
}
export function useResearch() {
  const [result, setResult] = useState<ResearchResult>({ topics: [] })
  const [status, setStatus] = useState("")
  const reload = useCallback(async () => {
    try {
      setResult(await api("research/topics"))
      setStatus("")
    } catch (error) {
      setStatus(message(error))
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  return { result, status, reload }
}
const details = {
  angles: "Meme angles",
  relatable: "Relatable situation",
  roles: "3-person setup",
  hooks: "Hook options",
  keywords: "Search keywords",
  risks: "Risks",
}
export function Research() {
  const { result, status, reload } = useResearch()
  const [game, setGame] = useState("")
  const [filter, setFilter] = useState("")
  const [feedback, setFeedback] = useState("")
  const [busy, setBusy] = useState(false)
  const topics = result.topics
    .filter(
      (row) =>
        (!game || row.data.game === game) &&
        (!filter || row.data.status === filter),
    )
    .sort((a, b) => Number(b.data.score) - Number(a.data.score))
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          Game
          <select
            value={game}
            onChange={(event) => setGame(event.target.value)}
          >
            <option value="">All games</option>
            {[
              ...new Set(result.topics.map((row) => String(row.data.game))),
            ].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {topicStatuses.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await api("research/refresh", {})
              await reload()
              setFeedback("Research refreshed.")
            } catch (error) {
              setFeedback(message(error))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? "Refreshing…" : "Refresh now"}
        </Button>
        <span className="muted">
          Last refreshed {formatDate(result.sync?.at)}
        </span>
      </div>
      <Notice
        text={feedback || status || result.sync?.warnings.join(" · ") || ""}
      />
      <p className="muted">
        Score out of 10 · {scoreFormula}. Low competition uses this refresh’s
        matching source count as a proxy.
      </p>
      {topics.length === 0 && (
        <p className="muted">
          No matching topics. Refresh research or change the filters.
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {topics.map((row) => (
          <Panel key={row.id} title={String(row.data.title)}>
            <div className="flex flex-wrap gap-2">
              <span className="badge bg-lime-300 text-zinc-950">
                {String(row.data.score)}/10
              </span>
              <span className="badge">{String(row.data.game)}</span>
              {Boolean(row.data.flagged) && (
                <span className="badge bg-amber-300 text-zinc-950">
                  Unverified
                </span>
              )}
            </div>
            <p className="muted">{String(row.data.whyNow)}</p>
            <a
              href={String(row.data.url)}
              className="text-sm underline"
              target="_blank"
              rel="noreferrer"
            >
              Open source · {String(row.data.source)}
            </a>
            <details>
              <summary className="cursor-pointer">
                Topic brief and score breakdown
              </summary>
              <dl className="mt-2 space-y-2 text-sm">
                {Object.entries(details).map(([key, label]) => (
                  <div key={key}>
                    <dt className="font-semibold">{label}</dt>
                    <dd className="text-zinc-300">
                      {Array.isArray(row.data[key])
                        ? (row.data[key] as string[]).join(" · ")
                        : String(row.data[key])}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="muted mt-3">
                {Object.entries(row.data.factors as Record<string, number>)
                  .map(
                    ([key, value]) =>
                      key.replace(/([A-Z])/g, " $1") + " " + value.toFixed(1),
                  )
                  .join(" · ")}
              </p>
            </details>
            <label>
              Status
              <select
                value={String(row.data.status)}
                onChange={async (event) => {
                  try {
                    await api("research/status/" + row.id, {
                      status: event.target.value,
                    })
                    await reload()
                  } catch (error) {
                    setFeedback(message(error))
                  }
                }}
              >
                {topicStatuses.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
            </label>
          </Panel>
        ))}
      </div>
    </>
  )
}
