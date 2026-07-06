import { FeatureShowcase } from "@/components/FeatureShowcase";
import { Hero } from "@/components/Hero";
import Image from "next/image";
import Link from "next/link";
import {
  ListMusic,
  Music2,
  Play,
  Upload,
  Users,
  Vote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const COTE_LOGO = "/cote-foundation-logo.png";

const features = [
  {
    icon: ListMusic,
    title: "Spotify playlist import",
    description:
      "Create a bingo session from any Spotify playlist. Tracks are imported with default clip lengths you choose — 15, 30, or 45 seconds.",
  },
  {
    icon: Users,
    title: "Team workspaces",
    description:
      "Organize sessions under teams. Invite members, connect a shared Spotify account, and collaborate on the same playlist.",
  },
  {
    icon: Vote,
    title: "Clip proposals & voting",
    description:
      "Each member can propose their own clip range for a track. The team votes, and the winning proposal becomes the playback clip.",
  },
  {
    icon: Upload,
    title: "Bulk audio upload",
    description:
      "Upload MP3 files for preview, review, and guest playback. Match files to tracks automatically or assign them manually in a review dialog.",
  },
  {
    icon: Play,
    title: "Bingo night play session",
    description:
      "Run the game with a dedicated play view. Audio streams through Spotify Connect to your speaker, phone, or desktop.",
  },
] as const;

const steps = [
  {
    step: "1",
    title: "Import a playlist",
    description: "Connect your team's Spotify account and create a session from a playlist.",
  },
  {
    step: "2",
    title: "Curate the clips",
    description: "Edit waveforms, propose ranges, vote, and review until every track is bingo-ready.",
  },
  {
    step: "3",
    title: "Upload audio",
    description: "Add MP3 files so your team can preview clips and guests can play Clip Guess.",
  },
  {
    step: "4",
    title: "Run bingo night",
    description: "Use the play session for live rounds, or share the guess link for a pre-party warm-up.",
  },
] as const;

export function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-emerald-600">
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Music2 className="size-5" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">Bingo Playlist Configurator</span>
            <span className="sm:hidden">Bingo Playlist</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Hero />

        <FeatureShowcase />

        <section className="border-y border-border/60 bg-card/50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Also included</h2>
              <p className="mt-4 text-muted-foreground">
                Import playlists, collaborate as a team, upload audio, and run the live game — the
                rest of what you need around the core workflow.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:max-w-4xl lg:mx-auto">
              {features.map((feature) => (
                <Card key={feature.title} className="border-border/80 bg-card/80">
                  <CardHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <feature.icon className="size-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
            <p className="mt-4 text-muted-foreground">
              From playlist to bingo cards in four steps.
            </p>
          </div>
          <ol className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((item) => (
              <li key={item.step} className="relative rounded-xl border border-border/80 bg-card p-6">
                <span className="flex size-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white dark:bg-emerald-500 dark:text-emerald-950">
                  {item.step}
                </span>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border/60 bg-emerald-600 px-4 py-16 text-white sm:px-6 sm:py-20 dark:bg-emerald-700">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to configure your next bingo night?
            </h2>
            <p className="mt-4 text-emerald-50">
              Create a team, import a playlist, and start trimming clips with your crew today.
            </p>
            <Link href="/register" className="mt-8 inline-block">
              <Button
                variant="secondary"
                className="bg-white px-6 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900"
              >
                Get started for free
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-12 sm:px-6 sm:py-14">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              A project by
            </p>
            <Image
              src={COTE_LOGO}
              alt="COTE Foundation"
              width={280}
              height={140}
              className="h-24 w-auto sm:h-32"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
