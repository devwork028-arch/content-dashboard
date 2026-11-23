const dateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
export const istDay = (date: Date) => dateKey.format(date)
export function shiftDay(day: string, offset: number) {
  const date = new Date(day + "T12:00:00Z")
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
export function calendarDays(anchor: string, month: boolean) {
  const first = month ? anchor.slice(0, 7) + "-01" : anchor
  const weekday = new Date(first + "T12:00:00Z").getUTCDay()
  const start = shiftDay(first, -((weekday + 6) % 7))
  return Array.from({ length: month ? 42 : 7 }, (_, index) =>
    shiftDay(start, index),
  )
}
export const istInput = (value: string) =>
  new Date(Date.parse(value) + 19800000).toISOString().slice(0, 16)
export const fromIst = (value: string) =>
  new Date(value + "+05:30").toISOString()
