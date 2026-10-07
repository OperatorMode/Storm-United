// Something to read while a league loads: fun facts and quiz questions from
// across sports. A question's answer shows on the next slide.

export type Slide = { label: string | null; text: string; ms: number };

const FACTS = [
  "Basketball was invented in 1891 by James Naismith, using two peach baskets as hoops.",
  "Volleyball was invented in 1895 and was first called “Mintonette”.",
  "Most golf balls have between 300 and 500 dimples. They help the ball fly further.",
  "Every national flag in 1913 had at least one of the Olympic ring colours (counting the white background).",
  "The first written rules of Australian rules football were drawn up in Melbourne in 1859.",
  "A 1939 cricket Test in Durban was played over nine days and still ended in a draw: England had a ship to catch.",
  "In 1966 the football World Cup trophy was stolen in England. A dog called Pickles found it under a hedge.",
  "Ice hockey pucks are frozen before games so they bounce less on the ice.",
  "The Rugby World Cup trophy is called the Webb Ellis Cup.",
  "The marathon became 42.195 km at the 1908 London Olympics, so the race could start at Windsor Castle.",
  "A badminton shuttlecock is made with 16 feathers.",
  "A Major League baseball has 108 double stitches.",
  "Usain Bolt ran 100 m in 9.58 seconds in 2009. That’s about 37.6 km/h on average.",
  "Australia’s Hockeyroos won Olympic gold in 1988, 1996 and 2000.",
  "Netball grew out of an early version of basketball in the 1890s.",
  "The first modern Olympic Games had 241 athletes. Recent Summer Games have over 10,000.",
  "A football (soccer) pitch can be anywhere from 90 to 120 metres long under the Laws of the Game.",
];

const QUIZ: [string, string][] = [
  ["How many players does a netball team have on court?", "7. Each one has a position bib and their own zones."],
  ["Where were the first modern Olympic Games held in 1896?", "Athens, Greece."],
  ["How long is a marathon?", "42.195 km."],
  ["Which sport uses a shuttlecock?", "Badminton."],
  ["How many players does a rugby union team have on the field?", "15."],
  ["What’s the highest standard break in snooker?", "147."],
  ["How many points is a goal worth in AFL?", "6. A behind is worth 1."],
  ["How many holes are on a standard golf course?", "18."],
  ["How many rings are on the Olympic flag?", "5."],
  ["Which country has won the most men’s football World Cups?", "Brazil, with five titles."],
  ["In tennis, what’s a score of zero called?", "Love."],
  ["How many players does a basketball team have on court?", "5."],
  ["How many players does a water polo team have in the water, including the goalkeeper?", "7."],
  ["How many points is a touchdown worth in American football?", "6."],
];

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Progress messages with a fact or a question (then its answer) after each, in a fresh order every time. */
export function loadingSlides(progress: string[]): Slide[] {
  const extras: Slide[][] = shuffle([
    ...FACTS.map((text) => [{ label: "Did you know?", text, ms: 7000 }]),
    ...QUIZ.map(([q, a]) => [
      { label: "Quick question", text: q, ms: 6000 },
      { label: "Answer", text: a, ms: 4500 },
    ]),
  ]);
  const slides: Slide[] = [];
  const steps = Math.max(progress.length, extras.length);
  for (let i = 0; i < steps; i++) {
    // Once the progress messages run out, the last one ("still reading…") comes back now and then.
    const step = progress[i] ?? (i % 3 === 0 ? progress[progress.length - 1] : null);
    if (step) slides.push({ label: null, text: step, ms: 4000 });
    if (extras[i]) slides.push(...extras[i]);
  }
  return slides;
}
