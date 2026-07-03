"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { readJsonResponse } from "@/lib/read-json-response";

interface ClipGuessShareCardProps {
  sessionId: string;
}

export function ClipGuessShareCard({ sessionId }: ClipGuessShareCardProps) {
  const [enabled, setEnabled] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShare = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/guess-share`);
      const json = await readJsonResponse<{
        guessShareEnabled?: boolean;
        guessShareToken?: string | null;
        canManage?: boolean;
        error?: string;
      }>(res);
      if (!res.ok) {
        setError(json.error ?? "Failed to load guess share settings");
        return;
      }
      setEnabled(json.guessShareEnabled ?? false);
      setShareToken(json.guessShareToken ?? null);
      setCanManage(json.canManage ?? false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadShare();
  }, [loadShare]);

  const guessUrl =
    shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/guess/${shareToken}`
      : shareToken
        ? `/guess/${shareToken}`
        : null;

  async function patchShare(body: { enabled?: boolean; rotateToken?: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/guess-share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await readJsonResponse<{
        guessShareEnabled?: boolean;
        guessShareToken?: string | null;
        error?: string;
      }>(res);
      if (!res.ok) {
        setError(json.error ?? "Failed to update guess share");
        return;
      }
      setEnabled(json.guessShareEnabled ?? false);
      setShareToken(json.guessShareToken ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!guessUrl) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/guess/${shareToken}`
        : guessUrl;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">Loading ClipGuess settings…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">ClipGuess</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Share a public link so anyone can guess songs from your clips.
          </p>
        </div>
        {enabled && (
          <Link
            href={`/sessions/${sessionId}/guess-analytics`}
            className="text-sm font-medium text-emerald-600 hover:underline"
          >
            View analytics
          </Link>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {canManage ? (
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              disabled={saving}
              onChange={(e) => void patchShare({ enabled: e.target.checked })}
              className="size-4 accent-emerald-600"
            />
            Enable public guess link
          </label>

          {enabled && shareToken && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <code className="flex-1 truncate rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-900">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/guess/${shareToken}`
                    : `/guess/${shareToken}`}
                </code>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void patchShare({ rotateToken: true })}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
                >
                  Rotate link
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Rotating invalidates the previous link. Guests keep progress via their browser ID.
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          {enabled
            ? "Public guess link is enabled. Ask a team admin to manage the link."
            : "Public guess link is disabled."}
        </p>
      )}
    </div>
  );
}
