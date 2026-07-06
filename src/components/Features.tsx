import {
  ListMusic,
  AudioLines,
  Users,
  SquareCheckBig,
  Headphones,
  Upload,
  Play,
  Link2,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    icon: ListMusic,
    title: "Spotify playlist import",
    description:
      "Create a bingo session from any Spotify playlist. Tracks are imported with default clip lengths you choose — 15, 30, or 45 seconds.",
  },
  {
    icon: AudioLines,
    title: "Waveform clip editor",
    description:
      "Trim each song to the perfect moment using a visual waveform. Set precise start and end times so every clip is recognizable but not too easy.",
  },
  {
    icon: Users,
    title: "Team workspaces",
    description:
      "Organize sessions under teams. Invite members, connect a shared Spotify account, and collaborate on the same playlist.",
  },
  {
    icon: SquareCheckBig,
    title: "Clip proposals & voting",
    description:
      "Each member can propose their own clip range for a track. The team votes, and the winning proposal becomes the playback clip.",
  },
  {
    icon: Headphones,
    title: "Collaborative review",
    description:
      "Review clips with OK / Not OK verdicts. Flag tracks that need attention and track team progress until every song is ready.",
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
  {
    icon: Link2,
    title: "Clip Guess guest game",
    description:
      "Share a public link so guests hear short clips and guess which song they belong to — no account required. Progress saves on their device.",
  },
  {
    icon: BarChart3,
    title: "Guess analytics",
    description:
      "See how guests performed: correct guesses, hardest clips, and overall accuracy for each session.",
  },
];

export function Features() {
  return (
    <section className="border-t border-border/60 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            What it does
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Music bingo needs more than a playlist — every song needs a short, fair clip that players
            can recognize. This app is built for teams who want to prepare those clips together,
            then play confidently on bingo night.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group relative rounded-2xl border border-border/70 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary/20">
                <Icon className="size-5" aria-hidden="true" />
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
