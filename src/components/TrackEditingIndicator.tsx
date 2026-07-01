import { cn } from "@/lib/utils";
import type { TrackEditingBy } from "@/lib/track-edit-lock";

export function TrackEditingIndicator({
  editingBy,
  className,
}: {
  editingBy: TrackEditingBy;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300",
        className,
      )}
    >
      {editingBy.name} is editing
    </span>
  );
}
