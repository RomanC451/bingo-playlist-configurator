import Image from "next/image";
import { cn } from "@/lib/utils";

const showcaseItems = [
  {
    title: "Waveform clip editor",
    description:
      "Trim each song to the perfect moment using a visual waveform. Propose versions, see who is editing, and save clip ranges the whole team can vote on.",
    image: "/screenshots/clip-editor.png",
    alt: "Waveform clip editor with track list and version history",
  },
  {
    title: "Collaborative review",
    description:
      "Listen to each clip and mark it OK or Not OK. Reviews advance automatically so your team can clear the queue before bingo night.",
    image: "/screenshots/review-clips.png",
    alt: "Review clips screen with OK and Not OK buttons",
  },
  {
    title: "Clip Guess guest game",
    description:
      "Share a public link so guests hear short clips and pick which song they think it is — no account required, with progress saved on their device.",
    image: "/screenshots/clip-guess.png",
    alt: "Clip Guess guest game with audio player and song picker",
  },
  {
    title: "Guess analytics",
    description:
      "See aggregate guess accuracy, replays, and response time across all anonymous guests — per clip and for the whole session.",
    image: "/screenshots/guess-analytics.png",
    alt: "ClipGuess analytics dashboard with per-clip accuracy table",
  },
] as const;

export function FeatureShowcase() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Main features</h2>
        <p className="mt-4 text-muted-foreground">
          From curating clips with your team to running a guest guessing game — here is what the app
          looks like in practice.
        </p>
      </div>

      <div className="mt-16 space-y-20 sm:space-y-28">
        {showcaseItems.map((item, index) => {
          const imageFirst = index % 2 === 1;

          return (
            <div
              key={item.title}
              className={cn(
                "grid items-center gap-8 lg:grid-cols-2 lg:gap-12",
                imageFirst && "lg:[&>*:first-child]:order-2",
              )}
            >
              <div className={cn(!imageFirst && "lg:pr-4", imageFirst && "lg:pl-4")}>
                <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{item.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg shadow-black/5 dark:shadow-black/20">
                <Image
                  src={item.image}
                  alt={item.alt}
                  width={1440}
                  height={900}
                  className="h-auto w-full"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
