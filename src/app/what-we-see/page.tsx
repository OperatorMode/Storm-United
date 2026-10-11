import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "What Sidelnr’s owner sees · Sidelnr",
  description: "Sidelnr is self-managed by its families and coaches. Here is exactly what the owner can and can’t see, with screenshots.",
};

// Full transparency: the owner's page in the app, shown as it is (with made-up
// demo data), and what the owner can and can't do. Linked from the guide, the
// privacy policy and the terms. The pictures come from scripts/guide/shots-owner.json.
const SHOTS = [
  {
    src: "/guide/owner-1-page.webp",
    title: "The whole owner page",
    text: "Feedback people sent, how many teams and events there are (a number, no list), and the search boxes below. That’s all of it.",
  },
  {
    src: "/guide/owner-2-team.webp",
    title: "Finding a team or event",
    text: "Only by typing its name or link. It shows the name, its league, and its manager accounts with half the email hidden. No players, guests, answers or messages.",
  },
  {
    src: "/guide/owner-3-manager.webp",
    title: "A manager asks for help",
    text: "When someone writes in to be taken off a team or have their account deleted, the owner types their email to find it.",
  },
  {
    src: "/guide/owner-4-league.webp",
    title: "Official leagues",
    text: "Making a league official after talking to it, or taking the tick or an admin off. Not the league’s fixtures, teams or messages.",
  },
  {
    src: "/guide/owner-5-closed.webp",
    title: "Inside a team: closed",
    text: "The owner gets the same PIN screen as anyone else. No way into a team, an event, its chat or its private messages.",
  },
];

export default function WhatWeSeePage() {
  return (
    <LegalPage title="What Sidelnr’s owner sees" updated="11 October 2026">
      <div className="rounded-2xl border-2 border-zinc-900 bg-zinc-50 p-4">
        <p className="font-semibold">Sidelnr is a self-managed app.</p>
        <p className="mt-1">
          Each team is run by its coaches and families, and each event by its organisers. They decide who’s in, what’s
          posted and who can see it. Sidelnr provides the app and keeps it running, but doesn’t look into teams or events.
        </p>
      </div>

      <p>
        For full transparency, this page shows the owner’s page exactly as it is (with made-up example data), and what the
        owner can and can’t do.
      </p>

      <h2>The owner’s page, as it is</h2>
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

      <h2>What the owner can’t see in the app</h2>
      <ul>
        <li>Players’ names, squads, attendance, MVP votes and duties</li>
        <li>Who follows a child, families’ names and phones</li>
        <li>The Board, team chat and private messages, including the coach’s</li>
        <li>Event guest lists, answers and headcounts</li>
        <li>Your activities in My Activities</li>
        <li>A list of teams, events or accounts (only a count, and what’s typed into a search)</li>
        <li>Team PINs, join codes and organiser codes (they’re only stored scrambled, so nobody can read them)</li>
      </ul>

      <h2>What the owner can do</h2>
      <p>Only step in, when asked or when something’s wrong:</p>
      <ul>
        <li>Delete a team or event (the name has to be typed to confirm)</li>
        <li>Take a manager or organiser account off a team or event</li>
        <li>Reset a team PIN or organiser code, which locks out everyone who unlocked with it</li>
        <li>Delete a manager account that asks to be deleted</li>
        <li>Make a league official, or take the tick or a league admin off</li>
        <li>Read feedback sent through the app, and clean up old leftover records</li>
      </ul>
      <p>The owner’s page itself is protected by a password and a code from an authenticator app.</p>

      <h2>On the server</h2>
      <p>
        Like any app, Sidelnr’s data sits in a database (Supabase, in Sydney). Whoever runs the service can technically reach
        it there. We only do that to fix a problem, keep the service running, or act on a report or a request (for example to
        delete something), and never to read messages or look at a team or family for any other reason. We never sell data
        or use it for advertising.
      </p>

      <h2>Questions</h2>
      <p>
        More in our <Link href="/privacy">privacy policy</Link> and <Link href="/terms">terms</Link>. Anything else:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
