import type { OfficialLadder } from "@/lib/feeds";
import { formatDay, formatTime } from "@/lib/time";

// A linked league's ladder exactly as its own website shows it: same columns,
// same order. Our team's row is highlighted.
export function OfficialLadderTable({ ladder, us, ourName, tz }: { ladder: OfficialLadder; us: string; ourName: string; tz: string }) {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const isUs = (team: string) => same(team, us) || same(team, ourName);
  const synced = new Date(ladder.syncedAt);
  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs whitespace-nowrap text-zinc-500">
              <th className="w-6 py-1.5 pr-2 font-medium">#</th>
              <th className="py-1.5 pr-2 font-medium">Team</th>
              {ladder.columns.map((c, k) => (
                <th key={k} className="px-1.5 py-1.5 text-center font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ladder.rows.map((r, i) => {
              const mine = isUs(r.team);
              const last = ladder.columns.length - 1;
              return (
                <tr key={`${r.team}-${i}`} className={mine ? "bg-team font-semibold whitespace-nowrap text-on-team" : "border-t border-zinc-100 whitespace-nowrap"}>
                  <td className={`py-2 pr-2 ${mine ? "rounded-l-lg pl-2" : ""}`}>{i + 1}</td>
                  <td className="max-w-36 truncate py-2 pr-2">{mine ? ourName : r.team}</td>
                  {ladder.columns.map((_, k) => (
                    <td key={k} className={`px-1.5 py-2 text-center ${mine && k === last ? "rounded-r-lg" : ""}`}>
                      {r.values[k] ?? ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Official ladder from {ladder.source}, updated {formatDay(synced, tz)}, {formatTime(synced, tz)}.
      </p>
    </>
  );
}
