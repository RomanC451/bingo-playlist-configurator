"use client";

import { useEffect, useId, useRef, useState } from "react";

const MAX_COMMENT_LENGTH = 500;

interface ReviewNotOkDialogProps {
  open: boolean;
  loading?: boolean;
  trackName?: string;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}

export function ReviewNotOkDialog({
  open,
  loading = false,
  trackName,
  onClose,
  onSubmit,
}: ReviewNotOkDialogProps) {
  const titleId = useId();
  const commentId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) {
      setComment("");
      return;
    }
    textareaRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const trimmed = comment.trim();
  const canSubmit = trimmed.length <= MAX_COMMENT_LENGTH && !loading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/40"
        disabled={loading}
        onClick={onClose}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onSubmit(trimmed);
        }}
        className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 id={titleId} className="text-lg font-semibold text-rose-700 dark:text-rose-400">
          Not OK
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {trackName
            ? `What’s wrong with the clip for “${trackName}”?`
            : "What’s wrong with this clip?"}
        </p>

        <div className="mt-4">
          <label className="block text-sm font-medium" htmlFor={commentId}>
            Comment <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <textarea
            ref={textareaRef}
            id={commentId}
            rows={4}
            maxLength={MAX_COMMENT_LENGTH}
            value={comment}
            disabled={loading}
            placeholder="e.g. Clip starts too early, missing the intro hit…"
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <p className="mt-1 text-xs text-zinc-500">
            {trimmed.length}/{MAX_COMMENT_LENGTH}
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Confirm not OK"}
          </button>
        </div>
      </form>
    </div>
  );
}
