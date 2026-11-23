import { redirect } from "next/navigation"
import { session } from "@/lib/auth"
import { Button } from "@/components/ui/button"
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (await session()) redirect("/")
  const { error } = await searchParams
  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center p-6">
      <form className="panel grid gap-5" action="/api/login" method="post">
        <h1>Content Desk</h1>
        <p className="muted">Sign in to your private creator workspace.</p>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            maxLength={400}
          />
        </label>
        {error && (
          <p role="alert" className="text-rose-300">
            {error === "rate"
              ? "Too many attempts. Try again in 15 minutes."
              : error === "setup"
                ? "Sign-in is unavailable. Check the database and environment configuration."
                : "Incorrect password."}
          </p>
        )}
        <Button>Sign in</Button>
      </form>
    </main>
  )
}
