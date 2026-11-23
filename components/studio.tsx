"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "./ui/button"
import { Notice, Panel, formatDate, message, useRows } from "./common"
import { api } from "@/lib/http"
import { emptyMetadata, models, type Row } from "@/lib/models"
import type { z } from "zod"
import { YouTubeEdits } from "./youtube-edits"

type Script = z.infer<typeof models.script>
const blank: Script = {
  title: "Untitled script",
  body: "",
  format: "trio",
  roles: ["", "", ""],
}
function Editor({
  row,
  onDirty,
}: {
  row: Row
  onDirty: (value: boolean) => void
}) {
  const [draft, setDraft] = useState(() => models.script.parse(row.data))
  const [status, setStatus] = useState("Saved")
  const [attempt, setAttempt] = useState(0)
  const saved = useRef(JSON.stringify(draft))
  const revision = useRef(row.revision)
  const busy = useRef(false)
  const history = useRows("version", row.id)
  const value = JSON.stringify(draft)
  const dirty = value !== saved.current
  useEffect(() => {
    onDirty(dirty)
    if (!dirty) return
    const preventUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    const preventNavigation = (event: MouseEvent) => {
      const link =
        event.target instanceof Element && event.target.closest("a[href]")
      if (
        link &&
        !window.confirm("Leave this script and discard unsaved changes?")
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", preventUnload)
    document.addEventListener("click", preventNavigation, true)
    return () => {
      window.removeEventListener("beforeunload", preventUnload)
      document.removeEventListener("click", preventNavigation, true)
    }
  }, [dirty, onDirty])
  const reloadHistory = history.reload
  useEffect(() => {
    if (value === saved.current || busy.current) return
    setStatus("Unsaved changes")
    const timer = setTimeout(async () => {
      busy.current = true
      let next = false
      setStatus("Saving…")
      try {
        const result = await api<Row>("save/script/" + row.id, {
          data: draft,
          revision: revision.current,
        })
        revision.current = result.revision
        saved.current = value
        setStatus("Saved")
        void reloadHistory()
        next = true
      } catch (error) {
        setStatus(message(error))
      } finally {
        busy.current = false
        if (next) setAttempt((current) => current + 1)
      }
    }, 700)
    return () => clearTimeout(timer)
  }, [value, draft, attempt, row.id, reloadHistory])
  const words = draft.body.trim().split(/\s+/).filter(Boolean).length
  return (
    <>
      <label>
        Script title
        <input
          value={draft.title}
          maxLength={300}
          onChange={(event) =>
            setDraft({ ...draft, title: event.target.value })
          }
        />
      </label>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(250px,1fr)]">
        <Panel title="Script">
          <p className="muted">
            Show the joke or problem in the first 2 seconds.
          </p>
          <textarea
            aria-label="Script text"
            rows={16}
            maxLength={100000}
            value={draft.body}
            onChange={(event) =>
              setDraft({ ...draft, body: event.target.value })
            }
          />
          <div className="flex flex-wrap items-center gap-4">
            <span className="muted">
              {words} words · ~{Math.round(words / 2.5)} sec ·{" "}
              {draft.format === "solo" ? "30–60" : "45–90"} sec target
            </span>
            <Notice text={status} />
            {!["Saved", "Saving…", "Unsaved changes"].includes(status) && (
              <Button
                variant="outline"
                onClick={() => setAttempt((current) => current + 1)}
              >
                Retry save
              </Button>
            )}
          </div>
        </Panel>
        <div className="grid content-start gap-4">
          <Panel title="Roles">
            <label>
              Format
              <select
                value={draft.format}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    format: event.target.value as Script["format"],
                  })
                }
              >
                <option value="trio">3-person skit</option>
                <option value="solo">Solo clip</option>
              </select>
            </label>
            {draft.roles
              .slice(0, draft.format === "solo" ? 1 : 3)
              .map((note, index) => (
                <label key={index}>
                  {draft.format === "solo"
                    ? "Solo notes"
                    : "Role " + "ABC"[index]}
                  <textarea
                    rows={3}
                    value={note}
                    maxLength={5000}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        roles: draft.roles.map((entry, i) =>
                          i === index ? event.target.value : entry,
                        ),
                      })
                    }
                  />
                </label>
              ))}
          </Panel>
          <Panel title="Version history">
            <Notice text={history.error} />
            <div className="max-h-48 space-y-2 overflow-auto">
              {history.rows.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="muted">
                    v{String(version.data.revision)} ·{" "}
                    {formatDate(version.updatedAt)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setDraft(models.script.parse(version.data.snapshot))
                    }
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
const fields = {
  youtubeTitle: "Title",
  description: "Description",
  tags: "Tags",
  hashtags: "Hashtags",
  caption: "Caption",
  instagramHashtags: "Hashtags (4–5)",
  onScreen: "On-screen text",
  x: "Post",
} as const
const caps = {
  youtubeTitle: 60,
  description: 5000,
  tags: 300,
  hashtags: 300,
  caption: 2200,
  instagramHashtags: 300,
  onScreen: 300,
  x: 280,
}
const templates = {
  youtubeTitle: "[Game] — [Premise]",
  description: "[What happens]\n\n[Credits]\n[Links]",
  tags: "[game], [format], [topic]",
  hashtags: "#[Game] #[Format]",
  caption: "[Setup]\n[Question for viewers]",
  instagramHashtags: "#[Game] #[Format] #[Topic] #[Community]",
  onScreen: "[Opening situation]",
  x: "[Premise] + [Link]",
}
function Kit({ id, row }: { id: string; row?: Row }) {
  const [draft, setDraft] = useState(() =>
    row ? models.metadata.parse(row.data) : emptyMetadata,
  )
  const [revision, setRevision] = useState(row?.revision ?? 0)
  const [status, setStatus] = useState("")
  async function save() {
    try {
      const saved = await api<Row>("save/metadata/" + id, {
        data: draft,
        revision,
      })
      setRevision(saved.revision)
      setStatus("Metadata saved.")
    } catch (error) {
      setStatus(message(error))
    }
  }
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-3">
        {(
          [
            ["YouTube", "youtubeTitle", "description", "tags", "hashtags"],
            ["Instagram", "caption", "instagramHashtags", "onScreen"],
            ["X", "x"],
          ] as const
        ).map(([platform, ...keys]) => (
          <Panel title={platform} key={platform}>
            {keys.map((key) => (
              <div key={key} className="grid gap-2">
                <label>
                  {fields[key]}
                  <textarea
                    value={draft[key]}
                    rows={key === "description" || key === "caption" ? 5 : 2}
                    maxLength={caps[key]}
                    onChange={(event) =>
                      setDraft({ ...draft, [key]: event.target.value })
                    }
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="muted mr-auto">
                    {draft[key].length}/{caps[key]}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        [key]: draft[key] || templates[key],
                      })
                    }
                  >
                    Template
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void navigator.clipboard.writeText(draft[key]).then(
                        () => setStatus("Copied."),
                        (error) => setStatus(message(error)),
                      )
                    }
                  >
                    Copy
                  </Button>
                </div>
              </div>
            ))}
          </Panel>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => void save()}>Save metadata</Button>
        <Notice text={status} />
      </div>
      <YouTubeEdits metadata={draft} />
    </>
  )
}
export function Studio({ metadata = false }: { metadata?: boolean }) {
  const [dirty, setDirty] = useState(false)
  const scripts = useRows("script")
  const kits = useRows(metadata ? "metadata" : "script")
  const [active, setActive] = useState("")
  const [status, setStatus] = useState("")
  const selected =
    scripts.rows.find((row) => row.id === active) ?? scripts.rows[0]
  async function create() {
    if (
      dirty &&
      !window.confirm("Discard unsaved changes and create a new script?")
    )
      return
    try {
      const id = crypto.randomUUID()
      await api("save/script/" + id, { data: blank, revision: 0 })
      await scripts.reload()
      setActive(id)
    } catch (error) {
      setStatus(message(error))
    }
  }
  return (
    <>
      <div className="flex items-end gap-3">
        <label className="max-w-lg grow">
          Script
          <select
            value={selected?.id ?? ""}
            onChange={(event) => {
              if (
                !dirty ||
                window.confirm("Discard unsaved changes and switch scripts?")
              )
                setActive(event.target.value)
            }}
          >
            <option value="" disabled>
              Select a script
            </option>
            {scripts.rows.map((row) => (
              <option key={row.id} value={row.id}>
                {String(row.data.title)}
              </option>
            ))}
          </select>
        </label>
        {!metadata && <Button onClick={() => void create()}>New script</Button>}
      </div>
      <Notice text={status || scripts.error || (metadata ? kits.error : "")} />
      {selected ? (
        metadata ? (
          !kits.loading && (
            <Kit
              key={selected.id}
              id={selected.id}
              row={kits.rows.find((row) => row.id === selected.id)}
            />
          )
        ) : (
          <Editor key={selected.id} row={selected} onDirty={setDirty} />
        )
      ) : (
        <p className="muted">
          {scripts.loading
            ? "Loading scripts…"
            : "Create a script in Script Studio to get started."}
        </p>
      )}
    </>
  )
}
