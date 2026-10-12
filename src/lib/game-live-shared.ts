// My Game: what the sideline screen and the server share (no server code here,
// so the phone's side can use it too). See game-live.ts.

export type Spot = { x: number; y: number }; // percent across (x) and down (y) the pitch, our goal at the bottom
export type LiveGame = {
  onField: string[]; // player ids on the field
  pos: Record<string, Spot>; // where each one is
  clock: { elapsedMs: number; runningSince: string | null }; // paused: runningSince null
  scorers: Record<string, number>; // player id -> goals
  ownGoals: number; // goals for us scored by the other team
  them: number; // their goals
  doneSwaps: number[]; // rotation swap times (minutes) already dealt with (done or skipped)
  ended: boolean;
  startedAt: string | null; // first kick-off
};


export const emptyLive = (): LiveGame => ({
  onField: [],
  pos: {},
  clock: { elapsedMs: 0, runningSince: null },
  scorers: {},
  ownGoals: 0,
  them: 0,
  doneSwaps: [],
  ended: false,
  startedAt: null,
});

export const ourGoals = (g: LiveGame) => Object.values(g.scorers).reduce((a, b) => a + b, 0) + g.ownGoals;
