"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/http"
import { Button } from "./ui/button"
import { Notice, Panel, message } from "./common"
export type Connection = {
  connected: boolean
  scope: string
  channel?: string
  keys: Record<string, boolean>
  remaining: number
  limit: number
}
export function Connections() {
  const [state, setState] = useState<Connection>()
  const [error, setError] = useState("")
  const reload = () =>
    api<Connection>("integrations/status")
      .then(setState)
      .catch((e) => setError(message(e)))
  useEffect(() => {
    void reload()
  }, [])
  return (
    <Panel title="YouTube connection">
      <p>
        {state?.connected
          ? "Connected · " + state.channel
          : "Connect the owner channel for insights."}
      </p>
      <div className="flex flex-wrap gap-2">
        {[false, true].map((edit) => (
          <form
            key={String(edit)}
            action={"/api/google/connect" + (edit ? "?edit=1" : "")}
            method="post"
          >
            <Button variant="outline">
              {edit ? "Authorize metadata edits" : "Connect read-only"}
            </Button>
          </form>
        ))}
        {state?.connected && (
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await api("google/disconnect", {})
                await reload()
              } catch (e) {
                setError(message(e))
              }
            }}
          >
            Disconnect
          </Button>
        )}
      </div>
      {state && (
        <>
          <p className="muted">
            Estimated quota remaining {state.remaining} / {state.limit}.
            Metadata edits{" "}
            {state.scope.includes("youtube.force-ssl") ? "enabled" : "disabled"}
            .
          </p>
          <p className="muted">
            {Object.entries(state.keys)
              .map(([name, ok]) => name + " " + (ok ? "configured" : "missing"))
              .join(" · ")}
          </p>
        </>
      )}
      <Notice text={error} />
    </Panel>
  )
}
