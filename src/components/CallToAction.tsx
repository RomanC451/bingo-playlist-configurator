import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CallToAction() {
  return (
    <section className="relative overflow-hidden bg-primary py-24 text-primary-foreground sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_50%_-10%,rgba(255,255,255,0.18),transparent)]"
      />
      <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
        <h2 className="text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Ready to configure your next bingo night?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-primary-foreground/85">
          Create a team, import a playlist, and start trimming clips with your crew today.
        </p>
        <div className="mt-10 flex justify-center">
          <Link href="/register">
            <Button
              size="lg"
              variant="secondary"
              className="group rounded-full bg-background px-8 text-base font-semibold text-foreground shadow-xl shadow-black/20 hover:bg-background/90"
            >
              Get started for free
              <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
