import { directionsUrl } from "@/lib/league";

// "Directions" button: opens Google Maps (app or web) with a route to `place`.
export function Directions({ place, className = "" }: { place: string; className?: string }) {
  return (
    <a
      href={directionsUrl(place)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${className}`}
    >
      <svg viewBox="0 0 20 20" aria-hidden className="size-3.5" fill="currentColor">
        <path d="M10 1.5a6 6 0 0 0-6 6c0 4.3 5.2 10.2 5.4 10.5a.8.8 0 0 0 1.2 0C10.8 17.7 16 11.8 16 7.5a6 6 0 0 0-6-6Zm0 8.3a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6Z" />
      </svg>
      Directions
    </a>
  );
}
