import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// "No link? Tell us the league's name and where it plays": Sidelnr searches the
// web for the page where its fixtures (the draw) or ladder are published, and
// offers a few to pick from. The picked link then goes through the normal
// "read a link" step. Only used in team setup, after asking for a link first.

export type LeagueCandidate = { url: string; title: string; why: string };

const Found = z.object({
  candidates: z
    .array(
      z.object({
        url: z.string().describe("The page's full address"),
        title: z.string().describe("A short name for the page, e.g. 'Football South Coast: Draw'"),
        why: z.string().describe("One short sentence: what's on it (fixtures, ladder, which competitions)"),
      }),
    )
    .describe("Up to 4 pages, best first. Empty if nothing fits."),
});

export async function searchLeagueOnline(name: string, area: string): Promise<LeagueCandidate[]> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `A coach wants to find where their junior or community sports league publishes its fixtures (the draw) and ladder, so a team app can read them.

League: ${name}
Where it plays: ${area || "not given"}

Search the web and return the pages that list this league's fixtures, results or ladder: its own website's draw or fixtures page, an association's site, or a page on a fixtures platform (for example PlayHQ, Squadi, Dribl, GameDay or a public Google Sheet). Prefer a page that shows the games themselves over a home page. Only return pages that are really about this league in this area. If nothing fits, return none.`,
    },
  ];
  // A long search can pause; carry on a couple of times.
  for (let i = 0; i < 3; i++) {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
      output_config: { effort: "low", format: betaZodOutputFormat(Found) },
      messages,
    });
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason === "refusal" || !response.parsed_output) return [];
    return response.parsed_output.candidates
      .filter((c) => /^https?:\/\//i.test(c.url))
      .slice(0, 4)
      .map((c) => ({ url: c.url.slice(0, 500), title: c.title.slice(0, 120), why: c.why.slice(0, 200) }));
  }
  return [];
}
