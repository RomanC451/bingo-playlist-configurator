"use client";

import Image from "next/image";
import { Expand, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const showcaseItems = [
  {
    title: "Waveform clip editor",
    description:
      "Trim each song to the perfect moment using a visual waveform. Propose versions, see who is editing, and save clip ranges the whole team can vote on.",
    image: "/screenshots/clip-editor.png",
    alt: "Waveform clip editor with track list and version history",
    width: 1024,
    height: 572,
  },
  {
    title: "Collaborative review",
    description:
      "Listen to each clip and mark it OK or Not OK. Reviews advance automatically so your team can clear the queue before bingo night.",
    image: "/screenshots/review-clips.png",
    alt: "Review clips screen with OK and Not OK buttons",
    width: 1024,
    height: 644,
  },
  {
    title: "Clip Guess guest game",
    description:
      "Share a public link so guests hear short clips and pick which song they think it is — no account required, with progress saved on their device.",
    image: "/screenshots/clip-guess.png",
    alt: "Clip Guess guest game with audio player and song picker",
    width: 821,
    height: 922,
  },
  {
    title: "Guess analytics",
    description:
      "See aggregate guess accuracy, replays, and response time across all anonymous guests — per clip and for the whole session.",
    image: "/screenshots/guess-analytics.png",
    alt: "ClipGuess analytics dashboard with per-clip accuracy table",
    width: 1024,
    height: 731,
  },
] as const;

type ShowcaseItem = (typeof showcaseItems)[number];

function ExpandableScreenshot({ item }: { item: ShowcaseItem }) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-border/80 bg-card text-left shadow-lg shadow-black/5 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:scale-[1.02] hover:border-primary/35 hover:shadow-xl hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:shadow-black/20"
        aria-label={`Expand ${item.title} screenshot`}
      >
        <Image
          src={item.image}
          alt={item.alt}
          width={item.width}
          height={item.height}
          unoptimized
          className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.03]"
          sizes="(max-width: 1024px) 100vw, 576px"
        />
        <span className="pointer-events-none absolute inset-0 flex items-end justify-center bg-linear-to-t from-black/35 via-black/5 to-transparent pb-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            <Expand className="size-3.5" aria-hidden="true" />
            Click to expand
          </span>
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${item.title} screenshot`}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            className="relative w-full"
            style={{ maxWidth: item.width }}
          >
            <button
              type="button"
              onClick={close}
              className="absolute -top-2 right-0 z-10 flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80 sm:-right-2 sm:-top-2"
              aria-label="Close expanded screenshot"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
            <div className="overflow-hidden rounded-xl border border-white/10 shadow-2xl">
              <Image
                src={item.image}
                alt={item.alt}
                width={item.width}
                height={item.height}
                unoptimized
                className="h-auto max-h-[85vh] w-full"
                sizes={`${item.width}px`}
              />
            </div>
            <p className="mt-3 text-center text-sm text-white/80">{item.title}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function FeatureShowcase() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Main features</h2>
        <p className="mt-4 text-muted-foreground">
          From curating clips with your team to running a guest guessing game — here is what the app
          looks like in practice. Hover a screenshot to preview, then click to expand.
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

              <ExpandableScreenshot item={item} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
