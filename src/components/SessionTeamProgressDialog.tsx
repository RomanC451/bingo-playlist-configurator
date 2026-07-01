"use client";

import { type ReactNode, useEffect, useState } from "react";
import { AllReviewsDialog } from "@/components/TrackReviewsPanel";
import type { MemberReviewProgress } from "@/lib/track-review";
import { readJsonResponse } from "@/lib/read-json-response";

function DialogShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-team-progress-title"
        className="relative flex max-h-[min(36rem,90dvh)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 id="session-team-progress-title" className="text-lg font-semibold">
            {title}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8">{children}</div>
        <div className="border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function SessionTeamProgressDialog({
  sessionId,
  open,
  currentUserId,
  onClose,
}: {
  sessionId: string | null;
  open: boolean;
  currentUserId?: string | null;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<MemberReviewProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sessionId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setMembers([]);

    void (async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/review`);
        const json = await readJsonResponse<{
          members?: MemberReviewProgress[];
          error?: string;
        }>(res);
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Failed to load review progress");
          return;
        }
        setMembers(json.members ?? []);
      } catch {
        if (!cancelled) {
          setError("Failed to load review progress");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  if (!open) return null;

  if (loading) {
    return (
      <DialogShell title="Team reviews" onClose={onClose}>
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      </DialogShell>
    );
  }

  if (error) {
    return (
      <DialogShell title="Team reviews" onClose={onClose}>
        <p className="text-center text-sm text-destructive">{error}</p>
      </DialogShell>
    );
  }

  return (
    <AllReviewsDialog
      open={open}
      members={members}
      currentUserId={currentUserId}
      onClose={onClose}
    />
  );
}
