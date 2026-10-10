import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy · Sidelnr", description: "How Sidelnr handles your family’s information." };

export default function PrivacyPage() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Privacy policy" updated="11 October 2026">
      <p>
        Sidelnr is a team app for any team sport, and a planner for your family’s week: fixtures and results from the league,
        who’s playing, team chat and private messages, and your family’s own activities. Many of the people it’s about are
        children, so we keep what we collect to a minimum and never sell it or use it for advertising. This policy explains
        what we hold, how we protect it, who can see it, and how to have it removed. We follow the Australian Privacy
        Principles.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <b>Players’ names</b>, as the coach enters them. We ask coaches to use a first name and last initial only (for
          example “Sam T”).
        </li>
        <li>
          <b>Who you are in a team</b>, as you tell us: the player you belong to and who you are to them (Mum, Dad, Friend or
          anything you type), and your first name if you choose to add it. That’s how you show up in the chat and in private
          messages, for example “Leo’s Dad” or “Tom (Leo’s Dad)”. A player using their own phone picks their own name.
        </li>
        <li>
          <b>What you do in the app</b>: whether a child can play, duty and goalie sign-ups, MVP votes, “Got it” on coach
          posts, team chat, private messages, and any message you report.
        </li>
        <li>
          <b>Your phone, in each team</b>: a random id (not your phone number or any hardware id), the kind of phone (iPhone,
          Android or computer), when it last opened the team, and which children it follows.
        </li>
        <li>
          <b>Coaches’ and organisers’ email addresses</b>, used to send sign-in links (there are no passwords), a reminder
          when the season is about to end, and replies to requests they send us.
        </li>
        <li>
          <b>Notifications and calendar links</b>, if you turn them on: your browser’s notification address for this site,
          and which children the reminders are for.
        </li>
        <li>
          <b>Your family’s own activities</b>, if you add them in My Activities: who they’re for (a first name), what, when,
          an address if you add one, and who’s taking whom when things clash (for example “Dad”). They belong to your phone (and any phone you share them with using a code), not to
          an account.
        </li>
        <li>
          <b>Feedback you send us</b>: your message, the page you came from, the kind of phone, and your email if you add it
          for a reply.
        </li>
        <li>
          <b>League requests</b>: when someone asks for a league to be made official, their note and sign-in email.
        </li>
        <li>
          <b>Security records</b>: counts of wrong PINs and codes, stored against a scrambled version of the internet
          address (never the address itself) and cleared after a day.
        </li>
        <li>
          <b>Fixtures and results</b> from the competition, which are usually public already.
        </li>
      </ul>
      <p>
        We don’t collect dates of birth, photos of children, phone numbers or payment details. The only addresses are the
        places you choose to add to your own activities.
      </p>

      <h2>How we keep it safe</h2>
      <ul>
        <li>
          <b>Families decide who follows their child.</b> The first phone to pick a child is in. Any other phone that picks the
          same child waits until that family lets it in, and the family can say “Not us” to any phone, which can then never
          pick that child again. The coach can step in when a family can’t, for example after a lost phone.
        </li>
        <li>
          <b>One phone per player.</b> Only one phone can be a player themselves (“I am…”), so nobody can pretend to be them.
        </li>
        <li>
          <b>Private messages are for grown-ups.</b> Players’ own phones can’t use them. Only the people in a conversation can
          read it, and anyone can leave a group or block someone.
        </li>
        <li>
          <b>Report buttons</b> on chat and private messages send the message to the team’s managers, who can remove it.
        </li>
        <li>
          <b>Guess limits.</b> Five wrong team PINs, join codes or share codes lock that device out for 15 minutes, and the
          team’s managers are told when their PIN is under attack.
        </li>
        <li>
          <b>No passwords to steal.</b> Coaches sign in with one-time email links that expire after 15 minutes. Families need
          no account at all. A team’s join code can keep it private to its families.
        </li>
        <li>
          <b>Private ids stay private.</b> Each phone’s id never leaves our server: other people only ever see a name like
          “Ava’s Mum”.
        </li>
        <li>
          <b>Codes work once.</b> A code to share your activities with another phone works one time only.
        </li>
        <li>
          <b>Leagues belong to the leagues.</b> A league added from its website can’t be changed by whoever added it.
          Official access is set up by us, by request, after we’ve confirmed who’s asking.
        </li>
        <li>
          <b>The owner’s access</b> to run Sidelnr is protected by a password and a code from an authenticator app.
        </li>
        <li>
          <b>Encryption.</b> Everything travels over an encrypted connection (HTTPS), and our database provider encrypts the
          data it stores.
        </li>
      </ul>

      <h2>Who can see it</h2>
      <ul>
        <li>The squad, the next games, attendance, the Board and the team chat: people in that team and its managers.</li>
        <li>Private messages: only the people in that conversation (and the team’s managers, for a message that was reported).</li>
        <li>Which phones follow a child: that child’s family, and the team’s managers.</li>
        <li>MVP vote tallies: only the team’s managers.</li>
        <li>Your activities in My Activities: only your phone and the phones you’ve shared them with.</li>
        <li>League organisers see fixtures and results, not players, attendance or chat.</li>
        <li>Sidelnr itself, only to run and support the app, look into a report or a request, or fix a problem.</li>
      </ul>

      <h2>Services we use</h2>
      <p>
        To run Sidelnr we use a few trusted providers, who may store or process data outside Australia (for example in the
        United States): Supabase (database), Vercel (hosting), Resend (emails), and Anthropic and Browserless (reading public
        league web pages to import fixtures; no player or family information is sent to them). They only use the data to
        provide their service to us.
      </p>

      <h2>How long we keep it</h2>
      <p>
        A team’s information stays while the team uses Sidelnr, so season history (like MVP tallies) works. When a coach
        removes a player from the squad they disappear from the team, and their past attendance and votes stay only as
        history inside that team. When a team is deleted, its players, attendance, votes, messages and chat are deleted with
        it. Housekeeping records are cleared automatically every day: old sign-in links after a day, wrong-PIN counts after a day, records of
        which reminders were sent after 30 to 90 days, and feedback we’ve dealt with after six months.
      </p>

      <h2>Removing information</h2>
      <ul>
        <li>
          <b>On your phone:</b> <Link href="/me#forget">Forget this phone</Link> (at the bottom of My Activities) removes the
          teams and children it remembers. Remove an activity in My Activities to delete it.
        </li>
        <li>
          <b>A phone you don’t know:</b> say “Not us” under “Who follows…” on your team’s page.
        </li>
        <li>
          <b>From a team:</b> ask the coach to remove your child from the squad.
        </li>
        <li>
          <b>Coaches and organisers:</b> “Stop managing” takes you off a team (it carries on for its families), and “Delete my
          account” under My teams removes your account and email. Teams and leagues stay for everyone else.
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
