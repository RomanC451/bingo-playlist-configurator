import { CallToAction } from "@/components/CallToAction";
import { Features } from "@/components/Features";
import { FeatureShowcase } from "@/components/FeatureShowcase";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { SiteFooter } from "@/components/SiteFooter";
import Link from "next/link";
import { Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

        <Features />

        <HowItWorks />

        <CallToAction />
      </main>

      <SiteFooter />
    </div>
  );
}
