const steps = [
  {
    step: 1,
    title: "Import a playlist",
    description:
      "Connect your team's Spotify account and create a session from a playlist.",
  },
  {
    step: 2,
    title: "Curate the clips",
    description:
      "Edit waveforms, propose ranges, vote, and review until every track is bingo-ready.",
  },
  {
    step: 3,
    title: "Upload audio",
    description:
      "Add MP3 files so your team can preview clips and guests can play Clip Guess.",
  },
  {
    step: 4,
    title: "Run bingo night",
    description:
      "Use the play session for live rounds, or share the guess link for a pre-party warm-up.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border/60 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            From playlist to bingo cards in four steps.
          </p>
        </div>

        <div className="relative mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ step, title, description }) => (
            <div
              key={step}
              className="relative rounded-2xl border border-border/70 bg-card p-6 transition-colors hover:border-primary/40"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25">
                {step}
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
