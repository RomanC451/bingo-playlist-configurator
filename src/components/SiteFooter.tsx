import Image from "next/image";
import { Music } from "lucide-react";

const COTE_LOGO = "/cote-foundation-logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background py-14">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20">
            <Music className="size-4" aria-hidden="true" />
          </span>
          <span className="font-display text-sm font-bold tracking-tight text-primary">
            Bingo Playlist Configurator
          </span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
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

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} COTE Foundation. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
