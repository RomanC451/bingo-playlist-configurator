import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-10%] -z-10 mx-auto h-[520px] max-w-4xl rounded-full bg-primary/15 blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]"
      />

      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="size-1.5 rounded-full bg-primary" />
          Music bingo, configured together
        </span>

        <h1 className="mt-7 text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Bingo Playlist Configurator
        </h1>

        <p className="mt-4 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          by COTE Foundation
        </p>

        <p className="mt-8 text-balance text-xl font-medium text-foreground sm:text-2xl">
          Turn any Spotify playlist into a polished music bingo game.
        </p>

        <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          Bingo Playlist Configurator helps teams import playlists, trim songs into short clips,
          vote on the best moments, and run bingo night — or send guests a Clip Guess challenge
          before the event.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/register">
            <Button
              size="lg"
              className="group rounded-full px-7 text-base font-semibold shadow-xl shadow-primary/25"
            >
              Create free account
              <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-border bg-card/50 px-7 text-base font-semibold hover:bg-card"
            >
              Sign in
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
