// What every fixture source (TPP feed, uploaded file, sheet link, manual entry…)
// produces for one competition. The rest of the app only sees this shape.

export type SourceGame = {
  id: string; // stable id (attendance, votes and scores hang off it)
  round: number | null; // null for e.g. tournament games
  kickoff: Date;
  timeLabel: string; // as shown, e.g. "5:45 pm"
  pitch: string | null;
  stage?: string | null; // e.g. "Pool A", "Final" (events)
  home: string;
  away: string;
  score: { home: number; away: number } | null;
};

export type SourceData = {
  teams: string[]; // every team in the competition (for the ladder and set-up)
  games: SourceGame[];
  byes: { round: number; date: Date | null; team: string }[];
};
