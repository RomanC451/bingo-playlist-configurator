"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { readJsonResponse } from "@/lib/read-json-response";
import type { GuestReviewSummary } from "@/lib/guest-review-shared";

type GuestReviewsResponse = {
  session?: { id: string; name: string };
  reviewShareEnabled?: boolean;
  uniqueGuests?: number;
  totalReviews?: number;
  okCount?: number;
  notOkCount?: number;
  perClip?: GuestReviewSummary[];
  error?: string;
};

export default function GuestReviewsPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [reviewShareEnabled, setReviewShareEnabled] = useState(false);
  const [uniqueGuests, setUniqueGuests] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [okCount, setOkCount] = useState(0);
  const [notOkCount, setNotOkCount] = useState(0);
  const [perClip, setPerClip] = useState<GuestReviewSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { loading, begin, end } = useDelayedLoading();

  const load = useCallback(async () => {
    begin();
    try {
      const res = await fetch(`/api/sessions/${sessionId}/guest-reviews`);
      const json = await readJsonResponse<GuestReviewsResponse>(res);
      if (!res.ok) {
        setError(json.error ?? "Failed to load guest reviews");
        setInitialized(true);
        return;
      }
      setSessionName(json.session?.name ?? null);
      setReviewShareEnabled(json.reviewShareEnabled ?? false);
      setUniqueGuests(json.uniqueGuests ?? 0);
      setTotalReviews(json.totalReviews ?? 0);
      setOkCount(json.okCount ?? 0);
      setNotOkCount(json.notOkCount ?? 0);
      setPerClip(json.perClip ?? []);
      setError(null);
      setInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setInitialized(true);
    } finally {
      end();
    }
  }, [begin, end, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!initialized && loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <Breadcrumb
        className="mb-4"
        items={[
          { label: "Bingo sessions", href: "/sessions" },
          {
            label: sessionName ?? "Session",
            href: `/sessions/${sessionId}/edit`,
          },
          { label: "Guest reviews" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Guest reviews</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Anonymous OK / Not OK feedback collected from the public review link.
          </p>
        </div>
        <Link
          href={`/sessions/${sessionId}/edit`}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
        >
          Back to session
        </Link>
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      ) : null}

      {!reviewShareEnabled ? (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Guest review sharing is currently disabled. Enable it from Session actions → Guest
          review.
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <StatCard label="Guests" value={String(uniqueGuests)} />
        <StatCard label="Reviews" value={String(totalReviews)} />
        <StatCard label="OK" value={String(okCount)} />
        <StatCard label="Not OK" value={String(notOkCount)} />
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Track</th>
              <th className="px-4 py-3 font-medium">OK</th>
              <th className="px-4 py-3 font-medium">Not OK</th>
              <th className="px-4 py-3 font-medium">Comments</th>
            </tr>
          </thead>
          <tbody>
            {perClip.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No guest reviews yet.
                </td>
              </tr>
            ) : (
              perClip.map((clip) => (
                <tr key={clip.trackClipId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 align-top text-muted-foreground">
                    {clip.position + 1}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-3">
                      {clip.albumArtUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN album art
                        <img
                          src={clip.albumArtUrl}
                          alt=""
                          className="size-10 rounded object-cover"
                        />
                      ) : (
                        <div className="size-10 rounded bg-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">{clip.trackName}</p>
                        <p className="text-muted-foreground">{clip.artistName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-emerald-700 dark:text-emerald-400">
                    {clip.okCount}
                  </td>
                  <td className="px-4 py-3 align-top text-rose-700 dark:text-rose-400">
                    {clip.notOkCount}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {clip.comments.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-2">
                        {clip.comments.map((entry, index) => (
                          <li key={`${clip.trackClipId}-${index}`}>
                            <p className="font-medium">{entry.guestName}</p>
                            <p className="text-muted-foreground">{entry.comment}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
