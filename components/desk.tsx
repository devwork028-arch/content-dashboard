"use client"
import { Studio } from "./studio"
import { Calendar, Competitors } from "./planning"
import { Research } from "./research"
import { Overview, Preferences } from "./overview"
import { Connections } from "./integrations"
import { YouTubeAnalytics } from "./analytics"
import { SocialAnalytics, InstagramConnection } from "./social"
const titles: Record<string, string> = {
  dashboard: "Dashboard",
  studio: "Script Studio",
  metadata: "Metadata Kit",
  calendar: "Calendar",
  competitors: "Competitor Tracker",
  research: "Research",
  analytics: "Analytics",
  settings: "Settings",
}
export function Desk({ section }: { section: string }) {
  return (
    <div className="grid gap-5">
      <h1>{titles[section]}</h1>
      {section === "studio" ? (
        <Studio />
      ) : section === "metadata" ? (
        <Studio metadata />
      ) : section === "calendar" ? (
        <Calendar />
      ) : section === "competitors" ? (
        <Competitors />
      ) : section === "research" ? (
        <Research />
      ) : section === "dashboard" ? (
        <Overview />
      ) : section === "settings" ? (
        <>
          <Preferences />
          <Connections />
          <InstagramConnection />
        </>
      ) : section === "analytics" ? (
        <>
          <YouTubeAnalytics />
          <SocialAnalytics platform="Instagram" />
          <SocialAnalytics platform="X" />
        </>
      ) : null}
    </div>
  )
}
