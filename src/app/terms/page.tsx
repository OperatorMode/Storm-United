import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms · Sidelnr", description: "The terms for using Sidelnr." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="6 October 2026">
      <p>
        These terms apply when you use Sidelnr (sidelnr.app). By using it you agree to them. If you’re a coach or organiser
        setting up a team, league or event, you also agree on behalf of that group.
      </p>

      <h2>Using Sidelnr</h2>
      <ul>
        <li>Sidelnr is free to use at the moment. If that changes, we’ll tell you before anything is charged.</li>
        <li>Be kind. Don’t post anything abusive, discriminatory or inappropriate around children in the message board or chat.</li>
        <li>
          Coaches and managers are responsible for their team: who gets the team code, the squad list, and removing messages
          that shouldn’t be there.
        </li>
        <li>Only add players with their parents’ agreement, using a first name and last initial.</li>
        <li>Don’t try to access teams you haven’t been given the code for, or interfere with how Sidelnr works.</li>
      </ul>

      <h2>Fixtures and results</h2>
      <p>
        Fixtures and results come from the competitions, their websites or what organisers enter. We do our best to keep
        them accurate and up to date, but always check with your club or league if something looks wrong. We’re not
        responsible for games missed because of a wrong time or place shown in the app.
      </p>

      <h2>Your content</h2>
      <p>
        What you post (messages, chat, team details) stays yours. You let us store and show it to your team so the app works.
        We may remove content that breaks these terms, and suspend teams that misuse Sidelnr.
      </p>

      <h2>Liability</h2>
      <p>
        Sidelnr is provided as is. As far as the law allows, we’re not liable for indirect losses from using it or not being
        able to use it. Nothing here limits your rights under the Australian Consumer Law.
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle information, including children’s, is explained in our <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
