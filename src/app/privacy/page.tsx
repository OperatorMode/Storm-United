import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy · Sidelnr", description: "How Sidelnr handles your family’s information." };

export default function PrivacyPage() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Privacy policy" updated="10 October 2026">
      <p>
        Sidelnr is a team app for junior sport: fixtures, attendance, MVP votes, a message board and team chat. Most of the
        people it’s about are children, so we keep what we collect to a minimum and never sell it or use it for advertising.
        This policy explains what we hold, why, and how to have it removed. We follow the Australian Privacy Principles.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <b>Players’ names</b>, as the coach enters them. We ask coaches to use a first name and last initial only (for
          example “Sam T”).
        </li>
        <li>
          <b>What parents tap in the app</b>: whether a child can play, goalie volunteering, MVP votes, “Got it” on coach
          messages, team chat messages, and private messages between families. Private messages are only visible to the
          people in that conversation, unless one of them reports a message, which then shows it to the team’s managers.
        </li>
        <li>
          <b>Coaches’ and organisers’ email addresses</b>, used only to send sign-in links. There are no passwords.
        </li>
        <li>
          <b>Small cookies on your phone</b> that remember which team you joined and which child is yours, so you don’t have
          to pick again. They’re not used for tracking or advertising.
        </li>
        <li>
          <b>Notification and calendar links</b>, if you turn them on: your browser’s notification address for this site,
          and which child the reminders are for.
        </li>
        <li>
          <b>Fixtures and results</b> from the competition, which are usually public already.
        </li>
        <li>
          <b>Your family’s own activities</b>, if you add them in My Activities: who they’re for (a first name), what they are,
          when, and an address if you add one. They’re linked to your phone (and any phone you share them with using a code),
          not to an account, and only those phones can see them.
        </li>
      </ul>
      <p>
        We don’t collect dates of birth, photos of children, phone numbers or payment details. The only addresses are the
        places you choose to add to your own activities.
      </p>

      <h2>Who can see it</h2>
      <ul>
        <li>The squad list, attendance and chat are visible to people in that team (anyone with its team code) and its managers.</li>
        <li>MVP vote tallies are only visible to the team’s managers.</li>
        <li>League and event organisers see fixtures and results, not players, attendance or chat.</li>
        <li>Public event pages show the draw and results (team names only).</li>
      </ul>

      <h2>Services we use</h2>
      <p>
        To run Sidelnr we use a few trusted providers, who may store or process data outside Australia (for example in the
        United States): Supabase (database), Vercel (hosting), Resend (sign-in emails) and Anthropic (reading public league
        web pages to import fixtures; no player information is sent to it). They only use the data to provide their service to
        us.
      </p>

      <h2>How long we keep it</h2>
      <p>
        A team’s information stays while the team uses Sidelnr so season history (like MVP tallies) works. When a coach
        removes a player from the squad they disappear from the team, and their past attendance and votes are kept only as
        anonymous-looking history inside that team. When a team is deleted, its players, attendance, votes, messages and chat
        are deleted with it.
      </p>

      <h2>Removing your child’s information</h2>
      <ul>
        <li>
          <b>On your phone:</b> <Link href="/me#forget">Forget this phone</Link> (at the bottom of My Activities) removes the
          teams and children it remembers. Remove an activity in My Activities to delete it.
        </li>
        <li>
          <b>From a team:</b> ask the coach to remove your child from the squad.
        </li>
        <li>
          <b>Everything:</b> email {mail} with the team and your child’s name. We’ll delete their information within 30 days
          and let you know when it’s done.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can ask to see or correct the information we hold about you or your child, or complain about how we’ve handled
        it, by emailing {mail}. If you’re not happy with our response you can contact the Office of the Australian
        Information Commissioner (oaic.gov.au).
      </p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we’ll say so in the app before it applies.</p>
    </LegalPage>
  );
}
