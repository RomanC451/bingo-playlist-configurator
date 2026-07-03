"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { readJsonResponse } from "@/lib/read-json-response";
import type { ClipGuessAnalytics } from "@/lib/clip-guess-shared";

function formatPercent(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

export default function GuessAnalyticsPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<ClipGuessAnalytics | null>(null);
  const [guessShareEnabled, setGuessShareEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loading, begin, end } = useDelayedLoading();

  const loadAnalytics = useCallback(async () => {
    begin();
    try {
      const res = await fetch(`/api/sessions/${sessionId}/guess-analytics`);
      const json = await readJsonResponse<{
        session?: { id: string; name: string };
        guessShareEnabled?: boolean;
        analytics?: ClipGuessAnalytics;
        error?: string;
      }>(res);

      if (!res.ok) {
        setError(json.error ?? "Failed to load analytics");
        return;
      }

      setSessionName(json.session?.name ?? null);
      setGuessShareEnabled(json.guessShareEnabled ?? false);
      setAnalytics(json.analytics ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      end();
    }
  }, [begin, end, sessionId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div>
      <Breadcrumb
        className="mb-4"
        items={[
          { label: "Bingo sessions", href: "/sessions" },
          {
            label: sessionName ?? "Session",
            href: `/sessions/${sessionId}/edit`,
            skeleton: !sessionName,
          },
          { label: "ClipGuess analytics" },
        ]}
      />

      <h1 className="text-2xl font-semibold">ClipGuess analytics</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Aggregate guess accuracy across all anonymous guests.
      </p>

      {!guessShareEnabled && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Public guess link is disabled.{" "}
          <Link href={`/sessions/${sessionId}/edit`} className="font-medium underline">
            Enable it on the session editor
          </Link>
          .
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading && !analytics ? (
        <p className="mt-8 text-sm text-zinc-500">Loading…</p>
      ) : analytics ? (
        <div className="mt-8 space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Unique guests" value={String(analytics.uniqueGuests)} />
            <StatCard label="Total guesses" value={String(analytics.totalGuesses)} />
            <StatCard label="Correct guesses" value={String(analytics.correctGuesses)} />
            <StatCard
              label="Overall accuracy"
              value={formatPercent(analytics.overallAccuracy)}
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold">Per clip</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-4 py-2 font-medium">Track</th>
                    <th className="px-4 py-2 font-medium">Guesses</th>
                    <th className="px-4 py-2 font-medium">Correct</th>
                    <th className="px-4 py-2 font-medium">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {analytics.perClip.map((row) => (
                    <tr key={row.trackClipId}>
                      <td className="px-4 py-2 text-zinc-500">{row.position + 1}</td>
                      <td className="px-4 py-2">
                        <span className="font-medium">{row.trackName}</span>
                        <span className="block text-zinc-500">{row.artistName}</span>
                      </td>
                      <td className="px-4 py-2">{row.guessCount}</td>
                      <td className="px-4 py-2">{row.correctCount}</td>
                      <td className="px-4 py-2">{formatPercent(row.accuracy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
