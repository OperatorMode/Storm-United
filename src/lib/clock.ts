// Single source of "now". In local dev, DEMO_NOW (an ISO timestamp) lets you
// time-travel to e.g. a game night to try attendance/voting before the season.
export function now(): Date {
  if (process.env.NODE_ENV !== "production" && process.env.DEMO_NOW) {
    return new Date(process.env.DEMO_NOW);
  }
  return new Date();
}
