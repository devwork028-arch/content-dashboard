import "./globals.css"
import type { ReactNode } from "react"
export const metadata = {
  title: "Content Desk",
  description: "Private creator workspace",
}
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
