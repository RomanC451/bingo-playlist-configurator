"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/read-json-response";

interface GuestReviewSettingsDialogProps {
  sessionId: string;
  open: boolean;
  onClose: () => void;
}

export function GuestReviewSettingsDialog({
  sessionId,
  open,
  onClose,
}: GuestReviewSettingsDialogProps) {
  const [enabled, setEnabled] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShare = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/review-share`);
      const json = await readJsonResponse<{
        reviewShareEnabled?: boolean;
        reviewShareToken?: string | null;
        canManage?: boolean;
        error?: string;
      }>(res);
      if (!res.ok) {
        setError(json.error ?? "Failed to load guest review settings");
        return;
      }
      setEnabled(json.reviewShareEnabled ?? false);
      setShareToken(json.reviewShareToken ?? null);
      setCanManage(json.canManage ?? false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!open) return;
    void loadShare();
  }, [loadShare, open]);

  if (!open) return null;

  const reviewPath = shareToken ? `/review/${shareToken}` : null;
  const reviewUrl =
    reviewPath && typeof window !== "undefined"
      ? `${window.location.origin}${reviewPath}`
      : reviewPath;

  async function patchShare(body: { enabled?: boolean; rotateToken?: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/review-share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await readJsonResponse<{
        reviewShareEnabled?: boolean;
        reviewShareToken?: string | null;
        error?: string;
      }>(res);
      if (!res.ok) {
        setError(json.error ?? "Failed to update guest review share");
        return;
      }
      setEnabled(json.reviewShareEnabled ?? false);
      setShareToken(json.reviewShareToken ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!reviewUrl) return;
    await navigator.clipboard.writeText(reviewUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

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
        aria-labelledby="guest-review-settings-title"
        className="relative flex max-h-[min(32rem,90dvh)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="guest-review-settings-title" className="text-lg font-semibold">
              Guest review
            </h2>
            {!loading ? (
              <Badge
                className={
                  enabled
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground"
                }
              >
                {enabled ? "Link active" : "Disabled"}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Share a public link so guests can mark clips OK or Not OK with optional comments.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading guest review settings…</p>
          ) : (
            <div className="space-y-4">
              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

              {!canManage ? (
                <p className="text-sm text-muted-foreground">
                  {enabled
                    ? "Public guest review link is enabled. Ask a team admin to manage the link."
                    : "Public guest review link is disabled."}
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {enabled
                      ? "Copy, open, or rotate the public review link. Rotating invalidates the previous URL."
                      : "Enable the public link when you are ready for guests to review clips."}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={enabled ? "outline" : "default"}
                      className={enabled ? undefined : "bg-emerald-600 hover:bg-emerald-700"}
                      disabled={saving}
                      onClick={() => void patchShare({ enabled: !enabled })}
                    >
                      <Link2 className="size-4" aria-hidden="true" />
                      {enabled ? "Disable public link" : "Enable public link"}
                    </Button>
                  </div>

                  {enabled && reviewPath ? (
                    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                      {reviewUrl ? (
                        <p className="break-all font-mono text-xs text-muted-foreground">
                          {reviewUrl}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!reviewUrl || saving}
                          onClick={() => void copyLink()}
                        >
                          {copied ? (
                            <Check className="size-4" aria-hidden="true" />
                          ) : (
                            <Copy className="size-4" aria-hidden="true" />
                          )}
                          {copied ? "Copied" : "Copy link"}
                        </Button>
                        <Link
                          href={reviewPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonClassName({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          <ExternalLink className="size-4" aria-hidden="true" />
                          Open review page
                        </Link>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={saving}
                          onClick={() => void patchShare({ rotateToken: true })}
                        >
                          <RefreshCw className="size-4" aria-hidden="true" />
                          Rotate link
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
