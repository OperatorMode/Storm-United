import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms · Sidelnr", description: "The terms for using Sidelnr." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="11 October 2026">
      <p>
        These terms apply when you use Sidelnr (sidelnr.app). By using it you agree to them. If you’re a coach or organiser
        setting up a team or league, you also agree on behalf of that group.
      </p>

      <h2>Using Sidelnr</h2>
      <ul>
        <li>
          Sidelnr is free to use at the moment. If that changes, for example for teams or for My Activities, we’ll tell you
          before anything is charged, and you’ll be able to choose.
        </li>
        <li>Be kind. Don’t post anything abusive, discriminatory or inappropriate around children on the Board, in the chat or in private messages.</li>
        <li>
          Say who you really are. Pick the player you belong to and describe yourself truthfully (“Leo’s Dad”, “Ava’s
          Grandparent”). Don’t pick a child you aren’t connected to, or claim to be a player you’re not.
        </li>
        <li>
          Families decide who follows their child: only let in phones you know. A phone a family has said “Not us” to can’t
          follow that child again.
        </li>
        <li>
          Coaches and managers are responsible for their team: who gets the team code, the squad list, dealing with reported
          messages, and stepping in when a family can’t.
        </li>
        <li>Only add players with their parents’ agreement, using a first name and last initial.</li>
        <li>Don’t try to access teams you haven’t been given the code for, guess PINs or codes, or interfere with how Sidelnr works.</li>
      </ul>

      <h2>Leagues</h2>
      <ul>
        <li>
          Anyone can add a league with a link to its website so their team can use it. A league added this way belongs to the
          league, not to whoever added it, and can’t be changed by them.
        </li>
        <li>
          Official access (announcements to every team, the tick, and running an added league) is set up by Sidelnr for each
          league, by request. We may ask who you are and how to confirm it, and depending on the league it may be free or come
          with a fee, which we’ll agree with you by email first.
        </li>
      </ul>

      <h2>Fixtures and results</h2>
      <p>
        Fixtures and results come from the competitions, their websites or what organisers enter. We do our best to keep
        them accurate and up to date, but always check with your club or league if something looks wrong. We’re not
        responsible for games missed because of a wrong time or place shown in the app.
      </p>

      <h2>Your content</h2>
      <p>
        What you post (messages, chat, team details, activities) stays yours. You let us store and show it to the people it’s
        meant for so the app works. We may remove content that breaks these terms, and suspend phones, accounts or teams that
        misuse Sidelnr.
      </p>

      <h2>Leaving</h2>
      <p>
        You can leave at any time. Families can leave a team or forget their phone; coaches can stop managing a team or delete
        their account under My teams. Teams and leagues carry on for everyone else.
      </p>

      <h2>Liability</h2>
      <p>
        Sidelnr is provided as is. As far as the law allows, we’re not liable for indirect losses from using it or not being
        able to use it. Nothing here limits your rights under the Australian Consumer Law.
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle information, including children’s, and how we keep it safe, is explained in our{" "}
        <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
