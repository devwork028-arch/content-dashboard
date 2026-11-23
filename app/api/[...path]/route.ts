import { NextResponse } from "next/server"
import { ZodError } from "zod"
import {
  cookieOptions,
  createSession,
  equal,
  passwordValid,
  session,
  sessionCookie,
} from "@/lib/auth"
import { budget } from "@/lib/limits"
import { core } from "@/lib/core-api"

import { refreshResearch, researchApi } from "@/lib/research"

import { integrations } from "@/lib/integrations"
import { syncInsights } from "@/lib/insights"
export const maxDuration = 300
async function handler(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const [action, kind = "", id = ""] = (await params).path
  const origin = request.headers.get("origin")
  const appUrl = process.env.APP_URL ?? new URL(request.url).origin
  const redirect = (path: string) =>
    NextResponse.redirect(new URL(path, appUrl), 303)

  if (
    request.method === "POST" &&
    (!origin || origin !== new URL(appUrl).origin)
  )
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    )
  if (action === "login" && request.method === "POST") {
    try {
      const rate = await budget("login", 1, 12, 900000)
      if (!rate.ok) return redirect("/login?error=rate")
      const password = (await request.formData()).get("password")
      if (
        typeof password !== "string" ||
        password.length > 400 ||
        !passwordValid(password)
      )
        return redirect("/login?error=password")
      const response = redirect("/")
      response.cookies.set(sessionCookie, createSession(), {
        ...cookieOptions,
        maxAge: 28800,
      })
      return response
    } catch {
      return redirect("/login?error=setup")
    }
  }
  if (action === "cron" && request.method === "GET") {
    const secret = process.env.CRON_SECRET
    if (
      !secret ||
      !equal(request.headers.get("authorization") ?? "", "Bearer " + secret)
    )
      return NextResponse.json(
        { error: "Invalid cron credentials." },
        { status: 401 },
      )
    if (kind === "insights") {
      try {
        return NextResponse.json(await syncInsights())
      } catch {
        return NextResponse.json(
          { error: "Insights sync failed." },
          { status: 503 },
        )
      }
    }
    if (kind !== "research")
      return NextResponse.json({ error: "Route not found." }, { status: 404 })
    try {
      return NextResponse.json(await refreshResearch(false))
    } catch {
      return NextResponse.json(
        { error: "Research refresh failed." },
        { status: 503 },
      )
    }
  }
  if (!(await session()))
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 })
  if (action === "logout" && request.method === "POST") {
    const response = redirect("/login")
    response.cookies.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 })
    return response
  }
  try {
    const result =
      action === "research"
        ? await researchApi(request, kind, id)
        : ((await integrations(request, action, kind, id)) ??
          (await core(request, action, kind, id)))
    if (result instanceof Response) return result
    return result === undefined
      ? NextResponse.json({ error: "Route not found." }, { status: 404 })
      : NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof ZodError
        ? error.issues
            .map((issue) => issue.path.join(".") + " " + issue.message)
            .join(", ")
        : error instanceof Error && error.constructor === Error
          ? error.message
          : "The request could not be completed."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
export { handler as GET, handler as POST }
