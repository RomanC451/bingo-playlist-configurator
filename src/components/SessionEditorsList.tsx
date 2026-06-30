import { User } from "lucide-react";
import { formatRelativeTime } from "@/lib/relative-time";

export interface SessionEditorSummary {
  userId: string;
  name: string;
  trackCount: number;
  lastEditedAt: string;
}

interface SessionEditorsListProps {
  editors: SessionEditorSummary[];
}

export function SessionEditorsList({ editors }: SessionEditorsListProps) {
  return (
    <section className="mt-5 rounded-lg border border-border bg-card px-3 py-3 sm:px-4">
      <h2 className="text-sm font-semibold text-foreground">Participants</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Members who edited track clips in this session.
      </p>

      {editors.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No clip edits yet. Open a track and adjust the waveform to contribute.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {editors.map((editor) => (
            <li
              key={editor.userId}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <User className="size-3.5" aria-hidden="true" />
                </div>
                <span className="truncate font-medium text-foreground">{editor.name}</span>
              </div>
              <span className="shrink-0 text-muted-foreground">
                {editor.trackCount} track{editor.trackCount === 1 ? "" : "s"} ·{" "}
                {formatRelativeTime(editor.lastEditedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
