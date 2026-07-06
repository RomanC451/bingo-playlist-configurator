"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { readJsonResponse } from "@/lib/read-json-response";
import type { ClipGuessAnalytics, GuessMetricSummary } from "@/lib/clip-guess-shared";

type PerClipRow = ClipGuessAnalytics["perClip"][number];
type SortDirection = "asc" | "desc";
type SortColumn =
  | "position"
  | "track"
  | "guessCount"
  | "correctCount"
  | "accuracy"
  | "replaysMin"
  | "replaysAvg"
  | "replaysMax"
  | "timeMin"
  | "timeAvg"
  | "timeMax";

function formatPercent(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function isLowAccuracy(accuracy: number | null) {
  return accuracy != null && accuracy < 0.5;
}

function formatReplayCount(value: number | null) {
  if (value == null) return "—";
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatGuessTimeMs(value: number | null) {
  if (value == null) return "—";
  if (value < 1000) return `${Math.round(value)}ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function MetricSummaryCell({
  summary,
  formatter,
}: {
  summary: GuessMetricSummary;
  formatter: (value: number | null) => string;
}) {
  if (summary.min == null && summary.average == null && summary.max == null) {
    return <span className="text-zinc-500">—</span>;
  }

  const rows = [
    { label: "Min", value: summary.min },
    { label: "Avg", value: summary.average },
    { label: "Max", value: summary.max },
  ] as const;

  return (
    <dl className="space-y-0.5 whitespace-nowrap">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline gap-2">
          <dt className="w-7 shrink-0 text-xs text-zinc-500">{row.label}</dt>
          <dd>{formatter(row.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  const rank = (value: number | null | undefined) =>
    value == null ? Number.NEGATIVE_INFINITY : value;

  return rank(a) - rank(b);
}

function compareRows(
  a: PerClipRow,
  b: PerClipRow,
  column: SortColumn,
  direction: SortDirection,
): number {
  let result = 0;

  switch (column) {
    case "position":
      result = a.position - b.position;
      break;
    case "track": {
      const byTrack = a.trackName.localeCompare(b.trackName, undefined, { sensitivity: "base" });
      result =
        byTrack !== 0
          ? byTrack
          : a.artistName.localeCompare(b.artistName, undefined, { sensitivity: "base" });
      break;
    }
    case "guessCount":
      result = a.guessCount - b.guessCount;
      break;
    case "correctCount":
      result = a.correctCount - b.correctCount;
      break;
    case "accuracy":
      result = compareNullableNumber(a.accuracy, b.accuracy);
      break;
    case "replaysMin":
      result = compareNullableNumber(a.replays.min, b.replays.min);
      break;
    case "replaysAvg":
      result = compareNullableNumber(a.replays.average, b.replays.average);
      break;
    case "replaysMax":
      result = compareNullableNumber(a.replays.max, b.replays.max);
      break;
    case "timeMin":
      result = compareNullableNumber(a.correctGuessTimeMs.min, b.correctGuessTimeMs.min);
      break;
    case "timeAvg":
      result = compareNullableNumber(a.correctGuessTimeMs.average, b.correctGuessTimeMs.average);
      break;
    case "timeMax":
      result = compareNullableNumber(a.correctGuessTimeMs.max, b.correctGuessTimeMs.max);
      break;
  }

  return direction === "asc" ? result : -result;
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) {
    return <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />;
  }

  return direction === "asc" ? (
    <ArrowUp className="size-3.5" aria-hidden />
  ) : (
    <ArrowDown className="size-3.5" aria-hidden />
  );
}

function SortableHeaderButton({
  label,
  column,
  activeColumn,
  direction,
  onSort,
  className,
}: {
  label: string;
  column: SortColumn;
  activeColumn: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  className?: string;
}) {
  const active = activeColumn === column;

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`inline-flex items-center gap-1 font-medium transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 ${
        active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"
      } ${className ?? ""}`}
    >
      <span>{label}</span>
      <SortIcon active={active} direction={direction} />
    </button>
  );
}

function MetricSortHeader({
  title,
  columns,
  activeColumn,
  direction,
  onSort,
}: {
  title: string;
  columns: Array<{ label: string; column: SortColumn }>;
  activeColumn: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{title}</p>
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        {columns.map((item) => {
          const active = activeColumn === item.column;
          return (
            <button
              key={item.column}
              type="button"
              onClick={() => onSort(item.column)}
              className={`inline-flex items-center gap-0.5 text-xs transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 ${
                active ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"
              }`}
            >
              <span>{item.label}</span>
              <SortIcon active={active} direction={direction} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function GuessAnalyticsPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<ClipGuessAnalytics | null>(null);
  const [guessShareEnabled, setGuessShareEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const { loading, begin, end } = useDelayedLoading();

  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  }, [sortColumn]);

  const sortedPerClip = useMemo(() => {
    if (!analytics) return [];

    return [...analytics.perClip].sort((a, b) => compareRows(a, b, sortColumn, sortDirection));
  }, [analytics, sortColumn, sortDirection]);

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
        Aggregate guess accuracy, replays, and response time across all anonymous guests.
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

          <div className="grid gap-4 sm:grid-cols-2">
            <MetricSummaryCard
              title="Replays per guess"
              description="Min / average / max clip replays before submitting."
              summary={analytics.replays}
              formatter={formatReplayCount}
            />
            <MetricSummaryCard
              title="Time to correct guess"
              description="Min / average / max time from first play to a correct submit."
              summary={analytics.correctGuessTimeMs}
              formatter={formatGuessTimeMs}
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold">Per clip</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2">
                      <SortableHeaderButton
                        label="#"
                        column="position"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <SortableHeaderButton
                        label="Track"
                        column="track"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <SortableHeaderButton
                        label="Guesses"
                        column="guessCount"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <SortableHeaderButton
                        label="Correct"
                        column="correctCount"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <SortableHeaderButton
                        label="Accuracy"
                        column="accuracy"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <MetricSortHeader
                        title="Replays"
                        columns={[
                          { label: "Min", column: "replaysMin" },
                          { label: "Avg", column: "replaysAvg" },
                          { label: "Max", column: "replaysMax" },
                        ]}
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <MetricSortHeader
                        title="Correct guess time"
                        columns={[
                          { label: "Min", column: "timeMin" },
                          { label: "Avg", column: "timeAvg" },
                          { label: "Max", column: "timeMax" },
                        ]}
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {sortedPerClip.map((row) => {
                    const lowAccuracy = isLowAccuracy(row.accuracy);

                    return (
                    <tr
                      key={row.trackClipId}
                      className={
                        lowAccuracy
                          ? "bg-amber-50/80 dark:bg-amber-950/25"
                          : undefined
                      }
                    >
                      <td className="px-4 py-2 text-zinc-500">{row.position + 1}</td>
                      <td className="px-4 py-2">
                        <span className="font-medium">{row.trackName}</span>
                        <span className="block text-zinc-500">{row.artistName}</span>
                      </td>
                      <td className="px-4 py-2">{row.guessCount}</td>
                      <td className="px-4 py-2">{row.correctCount}</td>
                      <td
                        className={
                          lowAccuracy
                            ? "px-4 py-2 font-medium text-amber-800 dark:text-amber-300"
                            : "px-4 py-2"
                        }
                      >
                        {formatPercent(row.accuracy)}
                      </td>
                      <td className="px-4 py-2">
                        <MetricSummaryCell summary={row.replays} formatter={formatReplayCount} />
                      </td>
                      <td className="px-4 py-2">
                        <MetricSummaryCell
                          summary={row.correctGuessTimeMs}
                          formatter={formatGuessTimeMs}
                        />
                      </td>
                    </tr>
                    );
                  })}
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

function MetricSummaryCard({
  title,
  description,
  summary,
  formatter,
}: {
  title: string;
  description: string;
  summary: GuessMetricSummary;
  formatter: (value: number | null) => string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-xs text-zinc-500">Min</dt>
          <dd className="mt-1 text-lg font-semibold">{formatter(summary.min)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Average</dt>
          <dd className="mt-1 text-lg font-semibold">{formatter(summary.average)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Max</dt>
          <dd className="mt-1 text-lg font-semibold">{formatter(summary.max)}</dd>
        </div>
      </dl>
    </div>
  );
}
