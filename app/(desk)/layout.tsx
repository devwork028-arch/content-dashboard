import Link from "next/link"
import { redirect } from "next/navigation"
import {
  CalendarDays,
  ChartNoAxesCombined,
  Clapperboard,
  FileText,
  LayoutDashboard,
  Search,
  Settings,
  Users,
} from "lucide-react"
import type { ReactNode } from "react"
import { session } from "@/lib/auth"
import { Button } from "@/components/ui/button"

const navigation = [
  ["/", "Dashboard", LayoutDashboard],
  ["/research", "Research", Search],
  ["/studio", "Script Studio", Clapperboard],
  ["/metadata", "Metadata Kit", FileText],
  ["/calendar", "Calendar", CalendarDays],
  ["/competitors", "Competitor Tracker", Users],
  ["/analytics", "Analytics", ChartNoAxesCombined],
  ["/settings", "Settings", Settings],
] as const
export default async function Layout({ children }: { children: ReactNode }) {
  if (!(await session())) redirect("/login")
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b border-zinc-800 bg-[#151617] p-4 md:min-h-screen md:border-b-0 md:border-r">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="rounded bg-lime-300 p-1 text-zinc-950">
            <Clapperboard size={18} />
          </span>
          Content Desk
        </Link>
        <nav
          aria-label="Workspace"
          className="my-5 flex gap-1 overflow-x-auto md:grid"
        >
          {navigation.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className="flex shrink-0 items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <form action="/api/logout" method="post">
          <Button variant="outline">Sign out</Button>
        </form>
      </aside>
      <main className="mx-auto w-full max-w-[1450px] min-w-0 px-4 py-6 md:p-8">
        {children}
      </main>
    </div>
  )
}
