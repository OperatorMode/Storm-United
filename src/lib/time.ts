// Dates and times are shown in the league's own timezone (any IANA zone, e.g.
// "Europe/London"). Formatters are cached per zone.

export const DEFAULT_TZ = "Australia/Perth";

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(timeZone: string, kind: "day" | "time" | "when" | "weekday") {
  const key = `${kind}|${timeZone}`;
  let f = cache.get(key);
  if (!f) {
    const opts: Intl.DateTimeFormatOptions =
      kind === "day"
        ? { weekday: "short", day: "numeric", month: "short" }
        : kind === "time"
          ? { hour: "numeric", minute: "2-digit", hour12: true }
          : kind === "weekday"
            ? { weekday: "long", day: "numeric", month: "short" }
            : { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };
    try {
      f = new Intl.DateTimeFormat("en-AU", { ...opts, timeZone });
    } catch {
      f = new Intl.DateTimeFormat("en-AU", { ...opts, timeZone: DEFAULT_TZ }); // unknown zone
    }
    cache.set(key, f);
  }
  return f;
}

const tidy = (s: string) => s.replace(/\s*([ap])\.?m\.?/i, " $1m").toLowerCase();

/** "Mon, 12 Oct" */
export const formatDay = (d: Date, tz = DEFAULT_TZ) => fmt(tz, "day").format(d);
/** "5:45 pm" */
export const formatTime = (d: Date, tz = DEFAULT_TZ) => tidy(fmt(tz, "time").format(d));
/** "Monday 12 Oct" */
export const formatWeekday = (d: Date, tz = DEFAULT_TZ) => fmt(tz, "weekday").format(d);
/** "Mon, 12 Oct, 5:45 pm" */
export const formatWhen = (d: Date | string, tz = DEFAULT_TZ) => fmt(tz, "when").format(typeof d === "string" ? new Date(d) : d);
/** A yyyy-mm-dd date as "Mon, 14 Dec" (noon avoids day shifts in any zone). */
export const formatIsoDate = (iso: string, tz = DEFAULT_TZ) => formatDay(new Date(`${iso}T12:00:00Z`), tz);

/** True for a timezone name the runtime understands, e.g. "America/New_York". */
export function isTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Every IANA timezone the runtime knows (for pickers). */
export function allTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [DEFAULT_TZ, "UTC"];
  }
}
