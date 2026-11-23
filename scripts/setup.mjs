import { randomBytes, scryptSync } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
const random = () => randomBytes(32).toString("base64url")
const password = random()
const salt = random()
const digest = scryptSync(password, salt, 64).toString("hex")
try {
  const generated = {
    OWNER_PASSWORD_HASH: salt + ":" + digest,
    SESSION_SECRET: random(),
    CRON_SECRET: random(),
    TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  }
  const template = readFileSync(new URL("../.env.example", import.meta.url), "utf8")
  const config = template.replace(
    /^([A-Z][A-Z0-9_]*)=[^\r\n]*/gm,
    (line, name) => Object.hasOwn(generated, name) ? name + "=" + generated[name] : line,
  )
  writeFileSync(".env.local", config, { flag: "wx", mode: 0o600 })
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
