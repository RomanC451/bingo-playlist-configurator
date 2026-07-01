"use client";

import { useEffect, useId, useRef, useState } from "react";

interface DeleteTeamDialogProps {
  teamName: string;
  open: boolean;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteTeamDialog({
  teamName,
  open,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeleteTeamDialogProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmation, setConfirmation] = useState("");

  const nameMatches = confirmation === teamName;

  useEffect(() => {
    if (!open) {
      setConfirmation("");
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleting) onCancel();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, deleting, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/40"
        disabled={deleting}
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
        aria-describedby={`${inputId}-description`}
        className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 id={`${inputId}-title`} className="text-lg font-semibold text-red-700 dark:text-red-400">
          Delete team
        </h2>
        <p id={`${inputId}-description`} className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This permanently removes the team, all members, bingo sessions, tracks, and clip
          versions. This cannot be undone.
        </p>
        <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
          Type{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{teamName}</span> to
          confirm.
        </p>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={confirmation}
          disabled={deleting}
          autoComplete="off"
          spellCheck={false}
          placeholder={teamName}
          onChange={(e) => setConfirmation(e.target.value)}
          className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!nameMatches || deleting}
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete team"}
          </button>
        </div>
      </div>
    </div>
  );
}
