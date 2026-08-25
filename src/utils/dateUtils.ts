// ── Unified date/time formatter ──────────────────────────────────────────────
// All formats use timeZone: "UTC" because message DateTime values are stored
// as local-as-UTC ISO strings (getLocalTime offsets by timezone before .toISOString()).
// Without timeZone: "UTC" the browser would apply the timezone a second time.

export type DateTimeFormat =
  | "time"           // "1:30 PM"
  | "chatTimestamp"  // "1:30 PM" | "Yesterday" | "Mon" | "12/01/26"
  | "dateHeader"     // "Today" | "Yesterday" | "Monday" | "12/01/2026"
  | "dateLocal"      // "01 Jan 2026"
  | "dateKey"        // "2026-01-12"
  | "full"           // "12/01/2026 at 1:30 PM"
  | "fullShort"      // "Jan 12, 2026 • 1:30 PM"
  | "fullLong"       // "January 12, 2026 at 1:30 PM"
  | "fullDayMonth";  // "12 Jan 2026 • 1:30 PM"

const TZ = "UTC";
const MS_DAY = 24 * 60 * 60 * 1000;

/** Get a yyyy-mm-dd date key in UTC. */
const tzDateKey = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

/** Format "h:mm AM/PM" in UTC. */
const tzTime = (d: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);

/**
 * One unified date/time formatter. Pass any date string/number/Date and a format preset.
 * All output uses timeZone: "UTC" to match the local-as-UTC storage pattern.
 */
export const formatDateTime = (
  input: string | number | Date | null | undefined,
  format: DateTimeFormat = "time"
): string => {
  if (!input) return "";
  const date = new Date(input);
  if (isNaN(date.getTime())) return String(input);

  try {
    // ── Simple formats ────────────────────────────────────────────────────
    if (format === "time") return tzTime(date);

    if (format === "dateKey") return tzDateKey(date);

    if (format === "dateLocal") {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    }

    // ── Full date + time formats ──────────────────────────────────────────
    if (format === "full" || format === "fullShort" || format === "fullLong" || format === "fullDayMonth") {
      const time = tzTime(date);
      if (format === "full") {
        const dd = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
        return `${dd} at ${time}`;
      }
      if (format === "fullShort") {
        const m = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short" }).format(date);
        const d = new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "2-digit" }).format(date);
        const y = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric" }).format(date);
        return `${m} ${d}, ${y} • ${time}`;
      }
      if (format === "fullLong") {
        const m = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long" }).format(date);
        const d = new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "2-digit" }).format(date);
        const y = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric" }).format(date);
        return `${m} ${d}, ${y} at ${time}`;
      }
      // fullDayMonth
      const dd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "2-digit" }).format(date);
      const m = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short" }).format(date);
      const y = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric" }).format(date);
      return `${dd} ${m} ${y} • ${time}`;
    }

    // ── Relative formats (chatTimestamp, dateHeader) ──────────────────────
    const now = new Date();
    const dateKey = tzDateKey(date);
    const nowKey = tzDateKey(now);
    const nowStart = new Date(`${nowKey}T00:00:00Z`);
    const dateStart = new Date(`${dateKey}T00:00:00Z`);
    const diffDays = Math.floor((nowStart.getTime() - dateStart.getTime()) / MS_DAY);
    const yesterdayKey = new Date(nowStart.getTime() - MS_DAY).toISOString().slice(0, 10);

    if (format === "chatTimestamp") {
      if (dateKey === nowKey) return tzTime(date);
      if (dateKey === yesterdayKey) return "Yesterday";
      if (diffDays >= 0 && diffDays < 7) {
        return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date);
      }
      return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
    }

    if (format === "dateHeader") {
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays > 0 && diffDays < 7) {
        return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(date);
      }
      return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
    }

    return tzTime(date);
  } catch {
    return String(input);
  }
};
