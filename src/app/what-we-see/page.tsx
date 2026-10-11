import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "What the Sidelnr app developer can see · Sidelnr",
  description:
    "Sidelnr is self-managed: teams belong to their managers and families. Here is exactly what the app developer can and can’t see, how it’s protected, with screenshots.",
};

// Full transparency: the developer's page in the app, shown as it is (with
// made-up demo data), what the developer can and can't do, and how that page is
// protected. Teams belong to their managers and families, so "owner" is never
// used for the developer here. Linked from the guide, the privacy policy and the
// terms. The pictures come from scripts/guide/shots-developer.json.
const SHOTS = [
  {
    src: "/guide/developer-1-page.webp",
    title: "The whole developer page",
    text: "Feedback people sent, how many teams and events there are (a number, no list), and the search boxes below. That’s all of it.",
  },
  {
    src: "/guide/developer-2-team.webp",
    title: "Finding a team or event",
    text: "Only by typing its name or link. It shows the name, its league, and its manager accounts with half the email hidden. No players, guests, answers or messages.",
  },
  {
    src: "/guide/developer-3-manager.webp",
    title: "A manager asks for help",
    text: "When someone writes in to be taken off a team or have their account deleted, the developer types their email to find it.",
  },
  {
    src: "/guide/developer-4-league.webp",
    title: "Official leagues",
    text: "Making a league official after talking to it, or taking the tick or an admin off. Not the league’s fixtures, teams or messages.",
  },
  {
    src: "/guide/developer-5-closed.webp",
    title: "Inside a team: closed",
    text: "The developer gets the same PIN screen as anyone else. No way into a team, an event, its chat or its private messages.",
  },
];

export default function WhatWeSeePage() {
  return (
    <LegalPage title="What the Sidelnr app developer can see" updated="11 October 2026">
      <div className="rounded-2xl border-2 border-zinc-900 bg-zinc-50 p-4">
        <p className="font-semibold">Sidelnr is a self-managed app.</p>
        <p className="mt-1">
          Teams belong to their managers and families, and events to their organisers and guests. They decide who’s in, what’s
          posted and who can see it. The developer builds the app and keeps it running, but doesn’t look into teams or events.
        </p>
      </div>

      <p>
        For full transparency, this page shows the developer’s page in the app exactly as it is (with made-up example data),
        what the developer can and can’t do, and how it’s protected.
      </p>

      <h2>The developer’s page, as it is</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {SHOTS.map((s) => (
          <figure key={s.src} className="space-y-2">
            <a href={s.src} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                alt={s.title}
                loading="lazy"
                className="mx-auto max-h-[560px] w-full max-w-[280px] rounded-[1.5rem] border-[5px] border-zinc-900 bg-zinc-100 object-cover object-top shadow-md"
              />
            </a>
            <figcaption className="mx-auto max-w-[280px] text-sm">
              <span className="block font-semibold">{s.title}</span>
              <span className="text-zinc-600">{s.text}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="text-sm text-zinc-500">Tap a picture to see it full size.</p>

      <h2>What the developer can’t see in the app</h2>
      <ul>
        <li>Players’ names, squads, attendance, MVP votes and duties</li>
        <li>Who follows a child, families’ names and phones</li>
        <li>The Board, team chat and private messages, including the coach’s</li>
        <li>Event guest lists, answers and headcounts</li>
        <li>Your activities in My Activities</li>
        <li>A list of teams, events or accounts (only a count, and what’s typed into a search)</li>
        <li>Team PINs, join codes and organiser codes (they’re only stored scrambled, so nobody can read them)</li>
      </ul>

      <h2>What the developer can do</h2>
      <p>Only step in, when asked or when something’s wrong:</p>
      <ul>
        <li>Delete a team or event (the name has to be typed to confirm)</li>
        <li>Take a manager or organiser account off a team or event</li>
        <li>Reset a team PIN or organiser code, which locks out everyone who unlocked with it</li>
        <li>Delete a manager account that asks to be deleted</li>
        <li>Make a league official, or take the tick or a league admin off</li>
        <li>Read feedback sent through the app, and clean up old leftover records</li>
      </ul>

      <h2>How it’s protected</h2>
      <ul>
        <li>
          <b>Two steps to sign in.</b> An email and password, then a 6-digit code from an authenticator app on the developer’s
          phone. A password on its own isn’t enough.
        </li>
        <li>
          <b>One account only.</b> Only one account is marked as the developer’s, and that mark can only be set in the database
          itself, never through the app. Nobody can sign up or switch their account to it.
        </li>
        <li>
          <b>Checked every time.</b> Every page and every button on the developer page is checked on our server, not just in
          the browser. If the account is ever blocked, it stops working straight away.
        </li>
        <li>
          <b>Short sessions.</b> A sign-in lasts 12 hours at most, and can be ended any time with Lock.
        </li>
        <li>
          <b>Wrong guesses are stopped.</b> After 5 wrong tries, signing in is locked for 15 minutes.
        </li>
        <li>
          <b>Hidden.</b> The page isn’t linked from the app and is kept out of search engines.
        </li>
        <li>
          <b>No way in by design.</b> The rules that keep teams, events and leagues closed apply to the developer too: there’s
          simply no screen in the app that shows what’s inside them.
        </li>
      </ul>

      <h2>On the server</h2>
      <p>
        Like any app, Sidelnr’s data sits in a database (Supabase, in Sydney), which encrypts what it stores. The key to the
        database never leaves our server, and everything travels over an encrypted connection (HTTPS). Whoever runs the
        service can technically reach the database there. We only do that to fix a problem, keep the service running, or act
        on a report or a request (for example to delete something), and never to read messages or look at a team or family
        for any other reason. We never sell data or use it for advertising.
      </p>

      <h2>Questions</h2>
      <p>
        More in our <Link href="/privacy">privacy policy</Link> and <Link href="/terms">terms</Link>. Anything else:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
