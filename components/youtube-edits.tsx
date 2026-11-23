"use client"
import { useEffect, useState } from "react"
import { Panel, Notice, message, formatDate } from "./common"
import { Button } from "./ui/button"
import { api } from "@/lib/http"
import { fromIst } from "@/lib/calendar"
import type { emptyMetadata } from "@/lib/models"
import type { Connection } from "./integrations"
type Preview = {
  id: string
  delta: { key: string; before: unknown; after: unknown }[]
}
type History = { id: string; video: string; kind: string; at: string }[]
const display = (v: unknown) =>
  Array.isArray(v) ? v.join(", ") : String(v ?? "—")
export function YouTubeEdits({ metadata }: { metadata: typeof emptyMetadata }) {
  const [preview, setPreview] = useState<Preview>(),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<History>([]),
    [quota, setQuota] = useState<Connection>()
  const [kind, setKind] = useState("metadata")
  async function reload() {
    const [h, q] = await Promise.all([
      api<History>("edits/history"),
      api<Connection>("integrations/status"),
    ])
    setHistory(h)
    setQuota(q)
  }
  useEffect(() => {
    void reload().catch((e) => setStatus(message(e)))
  }, [])
  async function run(task: () => Promise<void>) {
    setBusy(true)
    try {
      setStatus("")
      await task()
    } catch (e) {
      setStatus(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel title="Push to YouTube">
      <p className="muted">
        Upload and edit video files manually in YouTube Studio. Review changes
        here for an existing video. Estimated quota remaining{" "}
        {quota?.remaining ?? "—"}.
      </p>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onChange={() => setPreview(undefined)}
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void run(async () => {
            const payload: Record<string, unknown> = {
              video: form.get("video"),
              kind,
            }
            if (kind === "metadata") {
              const fields: Record<string, unknown> = {}
              if (form.has("title")) fields.title = metadata.youtubeTitle
              if (form.has("description"))
                fields.description = [metadata.description, metadata.hashtags]
                  .filter(Boolean)
                  .join("\n\n")
              if (form.has("tags"))
                fields.tags = metadata.tags
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean)
              for (const key of ["privacyStatus", "categoryId"])
                if (form.get(key)) fields[key] = form.get(key)
              if (form.get("time"))
                fields.publishAt = fromIst(String(form.get("time")))
              if (form.has("clearTime")) fields.publishAt = null
              payload.changes = fields
            } else if (kind === "playlist")
              payload.playlist = form.get("playlist")
            else {
              const file = form.get("thumbnail") as File
              if (file.size > 2097152)
                throw new Error("Choose a thumbnail up to 2 MB.")
              payload.image = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () =>
                  resolve(String(reader.result).split(",")[1])
                reader.onerror = () =>
                  reject(new Error("Could not read thumbnail."))
                reader.readAsDataURL(file)
              })
            }
            setPreview(await api("edits/preview", payload))
          })
        }}
      >
        <label>
          YouTube video ID
          <input name="video" required pattern="[A-Za-z0-9_\-]{11}" />
        </label>
        <label>
          Change
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="metadata">Metadata</option>
            <option value="thumbnail">Thumbnail</option>
            <option value="playlist">Playlist membership</option>
          </select>
        </label>
        {kind === "metadata" ? (
          <>
            <div className="grid gap-1">
              {["title", "description", "tags"].map((k) => (
                <label key={k} className="flex gap-2">
                  <input className="w-auto" type="checkbox" name={k} />
                  Apply kit {k}
                </label>
              ))}
            </div>
            <label>
              Category ID
              <input name="categoryId" placeholder="Keep existing" />
            </label>
            <label>
              Privacy
              <select name="privacyStatus">
                <option value="">Keep existing</option>
                {["private", "unlisted", "public"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              Schedule (IST)
              <input type="datetime-local" name="time" />
            </label>
            <label className="flex gap-2">
              <input className="w-auto" type="checkbox" name="clearTime" />
              Clear existing schedule
            </label>
          </>
        ) : kind === "playlist" ? (
          <label>
            Playlist ID
            <input name="playlist" required />
          </label>
        ) : (
          <label>
            Thumbnail
            <input
              name="thumbnail"
              type="file"
              accept="image/png,image/jpeg"
              required
            />
          </label>
        )}
        <Button disabled={busy}>Preview changes</Button>
      </form>
      {preview && (
        <div className="panel grid gap-3">
          <h2>Review changes</h2>
          {preview.delta.map((d) => (
            <p className="break-words text-sm" key={d.key}>
              <b>{d.key}</b>
              <br />
              {display(d.before)} → {display(d.after)}
            </p>
          ))}
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api("edits/confirm", { id: preview.id, confirm: true })
                setPreview(undefined)
                setStatus("Applied to YouTube.")
                await reload()
              })
            }
          >
            Confirm and push to YouTube
          </Button>
          <Button variant="outline" onClick={() => setPreview(undefined)}>
            Cancel
          </Button>
        </div>
      )}
      <Notice text={status} />
      <details>
        <summary>Edit history</summary>
        {history.map((h) => (
          <div key={h.id} className="my-2 flex flex-wrap items-center gap-3">
            <span>
              {h.video} · {h.kind} · {formatDate(h.at)}
            </span>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() =>
                void run(async () =>
                  setPreview(await api("edits/revert", { id: h.id })),
                )
              }
            >
              Preview revert
            </Button>
          </div>
        ))}
      </details>
    </Panel>
  )
}
