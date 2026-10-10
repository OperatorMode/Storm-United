import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Features & Functions · Sidelnr",
  description: "Everything Sidelnr does for players, parents, coaches, leagues and events.",
};

// What Sidelnr does, in plain words. Linked quietly from the page footers.
export default function FeaturesPage() {
  return (
    <LegalPage title="Features & Functions" updated="10 October 2026">
      <p>
        Sidelnr is a team app for any team sport. Parents and players don’t need an account: the coach shares a team code,
        and the phone remembers you. Add it to your home screen and it works like any other app.
      </p>

      <h2>For parents and players</h2>
      <ul>
        <li>
          <b>Team home:</b> the next game with time, venue and directions, your team’s fixtures and results, and the ladder.
        </li>
        <li>
          <b>I belong to… or I am…:</b> pick the player you belong to (or several, if siblings play in the same team) and say
          who you are to them: Mum, Dad, Grandparent, Friend or anything else, with your name if you like. Everyone shows up as
          themselves in the chat, like “Leo’s Dad”. Players pick their own name, and only one phone can be each player. Each family decides who follows their child: a new phone needs their OK, and they can say “Not us”.
        </li>
        <li>
          <b>Attendance:</b> tap Can play, Maybe or Can’t make it for each game, and see who else is in.
        </li>
        <li>
          <b>Special team role:</b> put your hand up for the team’s role (goalie, catcher, bowler…) for part of a game or the
          whole game.
        </li>
        <li>
          <b>My Activities:</b> every game, training and duty for all your children, across all their teams, plus the family’s
          own activities (music, dance, school, any other sport), in a list or a calendar, each person in their own colour.
          Clashes are flagged.
        </li>
        <li>
          <b>Your own activities:</b> for a child, yourself or anyone else. Add them every week (like training), just once, or
          import the dates from a calendar or a web page. Mark a single session as not on, and share all your activities, or just
          chosen ones, with another phone using a one-time code or an invitation link. Get a reminder a day before, an hour before, or both.
        </li>
        <li>
          <b>Board and chat:</b> messages from the coach (tap “Got it” so they know you’ve seen it), league announcements,
          and a team chat.
        </li>
        <li>
          <b>Private messages:</b> message someone in the team or the coach, or start a small group (“Carpool Saturday”). Leave
          a group any time, block a family, or report a message to the team’s managers. For parents and coaches only, not
          players.
        </li>
        <li>
          <b>MVP votes:</b> 3, 2 and 1 points after each game, with a season tally.
        </li>
        <li>
          <b>Training and duties:</b> training times, and the duty roster (canteen, scoring, oranges…) you can sign up to.
        </li>
        <li>
          <b>Notifications:</b> changed times, venues and cancellations, a “can your child play?” reminder, a match-day
          reminder, and new messages. Choose which ones you get.
        </li>
        <li>
          <b>Calendar:</b> add the team’s games, training and duties to your phone’s calendar; it stays up to date.
        </li>
      </ul>

      <h2>For coaches and managers</h2>
      <ul>
        <li>
          <b>Create a team</b> in your competition and share the team code with families. The squad can be filled in from the
          league’s website, a link to your club’s roster, or a file.
        </li>
        <li>
          <b>Manager’s Corner:</b> everything in one place, with a team PIN for co-coaches.
        </li>
        <li>
          <b>Game rotation:</b> fair playing time in minutes, with the swaps worked out for you and a season balance, so
          everyone gets their share.
        </li>
        <li>
          <b>Special team role:</b> name it (goalie, catcher, bowler…), set how your games are split (halves, quarters,
          periods, innings or sets), assign it per part of the game and keep a fair tally.
        </li>
        <li>
          <b>Training and duty roster:</b> weekly sessions on several days, extra sessions, and the duties families can take.
        </li>
        <li>
          <b>Messages:</b> post to the Board and see who has acknowledged it, and chat with the team.
        </li>
        <li>
          <b>Backup scores:</b> enter your own result when the league hasn’t posted one yet; the official score takes over
          once it’s out.
        </li>
        <li>
          <b>New season:</b> move the team into next season’s competition and keep its history.
        </li>
      </ul>

      <h2>For leagues</h2>
      <ul>
        <li>
          <b>Start from a link:</b> paste the league’s website and Sidelnr finds the competitions, teams, fixtures and the
          official ladder. If there are several competitions, you pick yours.
        </li>
        <li>
          <b>Live updates:</b> linked leagues are checked before each game and after it until the result and ladder are in.
          Their fixtures, results and ladder come from the official source and can’t be changed in Sidelnr.
        </li>
        <li>
          <b>Or run it in Sidelnr:</b> add teams and create a whole season of fixtures automatically (rounds, venues, pitches,
          balanced home games), upload a file or link a spreadsheet, and enter results. The ladder is worked out for you.
        </li>
        <li>
          <b>League announcements:</b> one-way news to all teams (posted on every team’s Board) or to team managers only
          (notification and email), e.g. a washed-out game day.
        </li>
        <li>
          <b>Official leagues:</b> announcements unlock once a league is verified, with a one-time code sent to an email on
          the league’s own domain, or after a review by Sidelnr. Verified leagues show a tick.
        </li>
      </ul>

      <h2>For events</h2>
      <ul>
        <li>
          <b>Carnivals and gala days:</b> pools, a draw for the day, finals with placeholders like “1st Pool A”, and a public
          page with live results to share with everyone on the day.
        </li>
      </ul>

      <h2>Good to know</h2>
      <ul>
        <li>Any timezone in the world, set per league.</li>
        <li>No account needed for parents and players; coaches and organisers sign in with an email link.</li>
        <li>Players are shown by first name and last initial.</li>
        <li>
          Ideas or problems? <Link href="/feedback?from=/features">Send feedback</Link> or email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </li>
      </ul>
    </LegalPage>
  );
}
