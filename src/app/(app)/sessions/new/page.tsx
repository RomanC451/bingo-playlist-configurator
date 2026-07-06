"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { TutorialWelcomeBanner } from "@/components/tutorial/TutorialWelcomeBanner";
import { errorMessageFromBody } from "@/lib/api-errors";

const DURATION_OPTIONS = [
  { label: "15 seconds", value: 15000 },
  { label: "30 seconds", value: 30000 },
  { label: "45 seconds", value: 45000 },
] as const;

export default function NewSessionPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [playlistInput, setPlaylistInput] = useState("");
  const [defaultClipDurationMs, setDefaultClipDurationMs] = useState<15000 | 30000 | 45000>(30000);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, playlistInput, defaultClipDurationMs }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(errorMessageFromBody(data, "Failed to create session"));
      return;
    }

    router.push(`/sessions/${data.id}/edit`);
  }

  return (
    <div className="mx-auto max-w-lg">
      <TutorialWelcomeBanner tutorialId="create-session" />

      <Breadcrumb
        className="mb-4"
        items={[
          { label: "Bingo sessions", href: "/sessions" },
          { label: "New bingo session" },
        ]}
      />
      <div>
      <h1 className="text-2xl font-semibold">New bingo session</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Paste a Spotify playlist URL or ID from a playlist the team&apos;s Spotify account
        owns or collaborates on. Tracks will be imported with default clip ranges.
      </p>
      <p className="mt-1 text-xs text-zinc-400">
        Spotify editorial playlists (e.g. Discover Weekly, Peaceful Piano) cannot be imported
        in development mode.
      </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div data-tutorial="session-name">
          <label className="block text-sm font-medium">Session name</label>
          <input
            type="text"
            required
            placeholder="80s Night Bingo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div data-tutorial="playlist-input">
          <label className="block text-sm font-medium">Spotify playlist</label>
          <input
            type="text"
            required
            placeholder="https://open.spotify.com/playlist/... (your playlist)"
            value={playlistInput}
            onChange={(e) => setPlaylistInput(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div data-tutorial="clip-duration">
          <label className="block text-sm font-medium">Default clip duration</label>
          <select
            value={defaultClipDurationMs}
            onChange={(e) =>
              setDefaultClipDurationMs(Number(e.target.value) as 15000 | 30000 | 45000)
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Importing playlist…" : "Create session"}
        </button>
      </form>
    </div>
  );
}
