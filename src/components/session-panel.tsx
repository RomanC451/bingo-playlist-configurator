import type { LucideIcon } from "lucide-react";
import { SessionCard, type Session } from "@/components/session-card";

type SessionPanelProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  badge: string;
  session: Session | null;
  emptyMessage?: string;
};

export function SessionPanel({
  icon: Icon,
  title,
  description,
  badge,
  session,
  emptyMessage,
}: SessionPanelProps) {
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-card-foreground text-balance">{title}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {badge}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>

      <div className="mt-5">
        {session ? (
          <SessionCard session={session} />
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyMessage ?? "No session yet."}
          </p>
        )}
      </div>
    </section>
  );
}
