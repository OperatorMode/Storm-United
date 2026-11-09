// Loan players: someone from another team who plays one game with us. They're
// added by name in Manager's Corner → Game rotation, live only in that game's
// rotation and My Game, and never count in the season tallies.

const PREFIX = "guest:";

export const isGuestId = (id: string) => id.startsWith(PREFIX) && guestName(id).length > 0 && id.length <= PREFIX.length + 30;
export const guestName = (id: string) => id.slice(PREFIX.length).trim();
/** The id for a loan player called `name` (tidied, at most 30 characters). */
export const guestId = (name: string) => PREFIX + name.replace(/\s+/g, " ").trim().slice(0, 30);
