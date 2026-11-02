import type { SportId } from "@/lib/sports";

// The field for each sport, from above, our goal (or basket) at the bottom.
// Cards sit on top in percent of the box, so any shape works.

export const FIELD_BOX: Record<SportId, string> = {
  soccer: "aspect-[68/100] bg-emerald-700",
  hockey: "aspect-[60/100] bg-sky-700",
  basketball: "aspect-[54/100] bg-orange-200",
  netball: "aspect-[50/100] bg-teal-700",
  "ice-hockey": "aspect-[50/100] bg-sky-50",
  afl: "aspect-[82/100] bg-emerald-700",
};

const white = { fill: "none", stroke: "rgba(255,255,255,0.75)", strokeWidth: 0.5 };

export function Field({ sport }: { sport: SportId }) {
  const svg = (w: number, children: React.ReactNode) => (
    <svg viewBox={`0 0 ${w} 100`} className="absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden>
      {children}
    </svg>
  );
  switch (sport) {
    case "basketball": {
      const line = { fill: "none", stroke: "rgba(60,30,10,0.55)", strokeWidth: 0.5 };
      const end = (y: number, dir: 1 | -1) => {
        const top = dir === 1 ? y : y - 20.7;
        const ft = y + dir * 20.7; // free-throw line
        const hoop = y + dir * 5.6;
        return (
          <g {...line}>
            <rect x="18.2" y={top} width="17.6" height="20.7" fill="rgba(180,80,20,0.18)" />
            <circle cx="27" cy={ft} r="6.5" />
            <line x1="3.2" y1={y} x2="3.2" y2={y + dir * 10} />
            <line x1="50.8" y1={y} x2="50.8" y2={y + dir * 10} />
            <path d={`M 3.2 ${y + dir * 10} A 24 24 0 0 ${dir === 1 ? 0 : 1} 50.8 ${y + dir * 10}`} />
            <circle cx="27" cy={hoop} r="1.4" stroke="rgba(200,60,20,0.9)" />
          </g>
        );
      };
      return svg(
        54,
        <>
          <rect x="1.5" y="1.5" width="51" height="97" {...line} />
          <line x1="1.5" y1="50" x2="52.5" y2="50" {...line} />
          <circle cx="27" cy="50" r="6.5" {...line} />
          {end(1.5, 1)}
          {end(98.5, -1)}
        </>,
      );
    }
    case "netball":
      return svg(
        50,
        <g {...white}>
          <rect x="1.5" y="1.5" width="47" height="97" />
          <line x1="1.5" y1="33.7" x2="48.5" y2="33.7" />
          <line x1="1.5" y1="66.3" x2="48.5" y2="66.3" />
          <circle cx="25" cy="50" r="1.6" />
          <path d="M 9 1.5 A 16 16 0 0 0 41 1.5" />
          <path d="M 9 98.5 A 16 16 0 0 1 41 98.5" />
          <circle cx="25" cy="3" r="0.8" />
          <circle cx="25" cy="97" r="0.8" />
        </g>,
      );
    case "hockey":
      return svg(
        60,
        <>
          <g {...white}>
            <rect x="2" y="2" width="56" height="96" />
            <line x1="2" y1="50" x2="58" y2="50" />
            <line x1="2" y1="25" x2="58" y2="25" strokeDasharray="1.5 1" />
            <line x1="2" y1="75" x2="58" y2="75" strokeDasharray="1.5 1" />
            {/* Shooting circles */}
            <path d="M 12 2 A 16 16 0 0 0 28 18 L 32 18 A 16 16 0 0 0 48 2" />
            <path d="M 12 98 A 16 16 0 0 1 28 82 L 32 82 A 16 16 0 0 1 48 98" />
            <rect x="27.5" y="0.5" width="5" height="1.5" />
            <rect x="27.5" y="98" width="5" height="1.5" />
          </g>
          <circle cx="30" cy="50" r="0.6" fill="rgba(255,255,255,0.8)" />
        </>,
      );
    case "ice-hockey": {
      const red = "rgba(220,38,38,0.7)";
      const blue = "rgba(37,99,235,0.7)";
      const faceoff = (cx: number, cy: number) => <circle cx={cx} cy={cy} r="7" fill="none" stroke={red} strokeWidth="0.4" />;
      return svg(
        50,
        <>
          <rect x="1.5" y="1.5" width="47" height="97" rx="10" fill="none" stroke="rgba(71,85,105,0.7)" strokeWidth="0.6" />
          <line x1="1.5" y1="50" x2="48.5" y2="50" stroke={red} strokeWidth="0.9" />
          <line x1="1.5" y1="37.5" x2="48.5" y2="37.5" stroke={blue} strokeWidth="0.9" />
          <line x1="1.5" y1="62.5" x2="48.5" y2="62.5" stroke={blue} strokeWidth="0.9" />
          <line x1="4" y1="7" x2="46" y2="7" stroke={red} strokeWidth="0.4" />
          <line x1="4" y1="93" x2="46" y2="93" stroke={red} strokeWidth="0.4" />
          <circle cx="25" cy="50" r="7" fill="none" stroke={blue} strokeWidth="0.4" />
          {faceoff(13, 19)}
          {faceoff(37, 19)}
          {faceoff(13, 81)}
          {faceoff(37, 81)}
          {/* Goal creases */}
          <path d="M 21 7 A 4 4 0 0 0 29 7 Z" fill="rgba(96,165,250,0.4)" stroke={red} strokeWidth="0.3" />
          <path d="M 21 93 A 4 4 0 0 1 29 93 Z" fill="rgba(96,165,250,0.4)" stroke={red} strokeWidth="0.3" />
        </>,
      );
    }
    case "afl":
      return svg(
        82,
        <>
          <g {...white}>
            <ellipse cx="41" cy="50" rx="39.5" ry="48.5" />
            <rect x="26" y="35" width="30" height="30" />
            <circle cx="41" cy="50" r="2" />
            <circle cx="41" cy="50" r="6" />
            {/* 50 metre arcs */}
            <path d="M 11 18 A 30 30 0 0 0 71 18" />
            <path d="M 11 82 A 30 30 0 0 1 71 82" />
            {/* Goal squares */}
            <rect x="37.2" y="1.5" width="7.6" height="5.5" />
            <rect x="37.2" y="93" width="7.6" height="5.5" />
          </g>
          <circle cx="41" cy="50" r="0.6" fill="rgba(255,255,255,0.8)" />
        </>,
      );
    default:
      return svg(
        68,
        <>
          <g {...white}>
            <rect x="2" y="2" width="64" height="96" />
            <line x1="2" y1="50" x2="66" y2="50" />
            <circle cx="34" cy="50" r="8" />
            <rect x="14" y="2" width="40" height="15" />
            <rect x="24" y="2" width="20" height="5.5" />
            <rect x="14" y="83" width="40" height="15" />
            <rect x="24" y="92.5" width="20" height="5.5" />
            <rect x="29" y="0.5" width="10" height="1.5" />
            <rect x="29" y="98" width="10" height="1.5" />
          </g>
          <circle cx="34" cy="50" r="0.7" fill="rgba(255,255,255,0.8)" />
        </>,
      );
  }
}

/** The ball (or puck) on a player's card: tap it when they score. */
export function ScoreIcon({ sport }: { sport: SportId }) {
  if (sport === "soccer") return <>⚽</>;
  const ball = (fill: string, lines: React.ReactNode) => (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
      <circle cx="10" cy="10" r="8.5" fill={fill} stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
      {lines}
    </svg>
  );
  switch (sport) {
    case "basketball":
      return ball(
        "#ea7a28",
        <g fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="0.9">
          <line x1="1.5" y1="10" x2="18.5" y2="10" />
          <line x1="10" y1="1.5" x2="10" y2="18.5" />
          <path d="M 4 4 Q 8 10 4 16" />
          <path d="M 16 4 Q 12 10 16 16" />
        </g>,
      );
    case "netball":
      return ball(
        "#fde68a",
        <g fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="0.9">
          <path d="M 2 9 Q 10 6 18 9" />
          <path d="M 2 12 Q 10 15 18 12" />
          <path d="M 10 1.5 Q 7 10 10 18.5" />
        </g>,
      );
    case "afl":
      return (
        <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
          <ellipse cx="10" cy="10" rx="8.5" ry="5.5" fill="#b91c1c" stroke="rgba(0,0,0,0.5)" strokeWidth="1" transform="rotate(-30 10 10)" />
          <line x1="7" y1="11.5" x2="13" y2="8.5" stroke="white" strokeWidth="0.9" />
        </svg>
      );
    case "ice-hockey":
      return (
        <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
          <ellipse cx="10" cy="12" rx="8" ry="3.5" fill="#111827" />
          <rect x="2" y="8" width="16" height="4" fill="#111827" />
          <ellipse cx="10" cy="8" rx="8" ry="3.5" fill="#374151" />
        </svg>
      );
    default:
      return ball("#f8fafc", <circle cx="10" cy="10" r="2" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />);
  }
}
