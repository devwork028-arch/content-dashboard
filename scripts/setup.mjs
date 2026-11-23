import { randomBytes, scryptSync } from "node:crypto"
import { writeFileSync } from "node:fs"
const random = () => randomBytes(32).toString("base64url")
const password = random()
const salt = random()
const digest = scryptSync(password, salt, 64).toString("hex")
try {
  writeFileSync(
    ".env.local",
    [
      "APP_URL=http://localhost:3000",
      "DATABASE_URL=",
      "OWNER_PASSWORD_HASH=" + salt + ":" + digest,
      "SESSION_SECRET=" + random(),
      "CRON_SECRET=" + random(),
      "TOKEN_ENCRYPTION_KEY=" + randomBytes(32).toString("base64"),
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  )
  console.log(
    "Save this dashboard password in your password manager:",
    password,
  )
  console.log(
    "Add your Postgres connection string to DATABASE_URL in .env.local.",
  )
} catch (error) {
  console.error(
    error.code === "EEXIST"
      ? "Your .env.local already exists."
      : "Could not create .env.local.",
  )
  process.exitCode = 1
}
