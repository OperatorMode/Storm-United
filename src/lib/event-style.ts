// My Event: the kind of event (each has its own background on the event page)
// and the dress codes offered (or the organiser types their own).

export const EVENT_TYPES = [
  { key: "party", label: "Party" },
  { key: "birthday", label: "Birthday" },
  { key: "dinner", label: "Dinner" },
  { key: "other", label: "Other" },
] as const;
export type EventType = (typeof EVENT_TYPES)[number]["key"];

export const DRESS_CODES = ["Casual", "Smart casual", "Formal"] as const;

export const isEventType = (v: unknown): v is EventType => EVENT_TYPES.some((t) => t.key === v);

/** The small heading on the event page: "Birthday", "Party", "Dinner", or just "Event". */
export function eventTypeLabel(type: string | null | undefined): string {
  return type && type !== "other" ? (EVENT_TYPES.find((t) => t.key === type)?.label ?? "Event") : "Event";
}
