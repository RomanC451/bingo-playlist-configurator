import Link from "next/link";
import { Clock, ListMusic, Pencil, Play, User } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";

export type Session = {
  id: string;
  title: string;
  playlist: string;
  tracks: number;
  author: string;
  updatedAt: string;
};

export function SessionCard({ session }: { session: Session }) {
  const initials = session.title.slice(0, 2).toUpperCase();

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-primary/40 hover:bg-background/70">
      <div
        aria-hidden="true"
        className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-base font-semibold text-primary"
      >
        {initials}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight text-card-foreground">{session.title}</p>
        <p className="truncate text-sm text-muted-foreground">{session.playlist}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ListMusic className="size-3.5" aria-hidden="true" />
            {session.tracks} tracks
          </span>
          <span className="inline-flex items-center gap-1">
            <User className="size-3.5" aria-hidden="true" />
            {session.author}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {session.updatedAt}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/sessions/${session.id}/edit`}
          className={buttonClassName({ variant: "outline", size: "sm", className: "gap-1.5" })}
        >
          <Pencil className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Edit</span>
        </Link>
        <Link
          href={`/sessions/${session.id}/play`}
          className={buttonClassName({ variant: "default", size: "sm", className: "gap-1.5" })}
        >
          <Play className="size-4 fill-current" aria-hidden="true" />
          Play
        </Link>
      </div>
    </div>
  );
}
