import { Skeleton } from "@/components/ui/skeleton";
import { SessionCardSkeleton } from "@/components/SessionCard";

export function SessionsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading sessions">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <Skeleton className="mt-6 h-24 w-full rounded-lg" />
      <ul className="mt-8 space-y-3">
        {[0, 1, 2].map((key) => (
          <li key={key}>
            <SessionCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading home">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <div className="space-y-6">
        <section className="flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="h-6 w-44" />
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-4 w-full max-w-sm" />
          <div className="mt-5 flex items-center gap-4 rounded-xl border border-border p-3">
            <Skeleton className="size-14 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3.5 w-48" />
            </div>
            <div className="flex shrink-0 gap-2">
              <Skeleton className="h-8 w-16 rounded-lg" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
        </section>
      </div>
    </div>
  );
}

export function TeamsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading teams">
      <header className="mb-8 space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </header>
      <div className="mb-8 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-11 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-52" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {[0, 1].map((key) => (
          <div key={key} className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="mt-4 h-5 w-32" />
            <Skeleton className="mt-1.5 h-4 w-full" />
            <Skeleton className="mt-4 h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrackPageSkeleton({ contentOnly = false }: { contentOnly?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading track">
      {!contentOnly && (
        <>
          <Skeleton className="mb-4 h-4 w-64" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </>
      )}
      {contentOnly && (
        <>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1 h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function TeamSettingsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading team settings">
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-44" />
      <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-2 h-3 w-full max-w-md" />
        <div className="mt-2 flex gap-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-7 w-16" />
        </div>
      </div>
      <ul className="mt-8 space-y-2">
        {[0, 1].map((key) => (
          <li
            key={key}
            className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-4 w-14" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-4" aria-busy="true" aria-label="Loading profile">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-64" />
      <div className="mt-8 flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="space-y-3 pt-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function EditSessionPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading session">
      <Skeleton className="mb-4 h-4 w-48" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-5 rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-800">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-1 h-4 w-64 max-w-full" />
        <Skeleton className="mt-3 h-10 w-full rounded-md" />
      </div>
      <ul className="mt-8 space-y-2">
        {[0, 1, 2, 3].map((key) => (
          <li
            key={key}
            className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <Skeleton className="size-12 shrink-0 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlaybackPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading playback">
      <Skeleton className="h-48 w-full max-w-xl rounded-xl" />
      <div className="mt-6 flex gap-3">
        <Skeleton className="h-10 w-20 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-20 rounded-lg" />
      </div>
      <Skeleton className="mt-6 h-16 w-full max-w-xl rounded-lg" />
    </div>
  );
}
