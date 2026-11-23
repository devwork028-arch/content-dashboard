import { notFound } from "next/navigation"
import { Desk } from "@/components/desk"
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (
    ![
      "studio",
      "metadata",
      "calendar",
      "competitors",
      "research",
      "analytics",
      "settings",
    ].includes(section)
  )
    notFound()
  return <Desk section={section} />
}
