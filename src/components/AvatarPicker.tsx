"use client";

import { useEffect, useId, useState } from "react";
import { Pencil } from "lucide-react";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { cn } from "@/lib/utils";

interface AvatarPickerProps {
  value: string | null;
  onChange: (url: string) => void;
  previewLabel: string;
}

function AvatarPreview({
  imageUrl,
  label,
  size = "lg",
}: {
  imageUrl: string | null;
  label: string;
  size?: "lg" | "md";
}) {
  const sizeClass = size === "lg" ? "size-16 text-lg" : "size-12 sm:size-14";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary ring-2 ring-border",
        sizeClass,
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <span className="font-semibold text-muted-foreground">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export function AvatarPicker({ value, onChange, previewLabel }: AvatarPickerProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function handleConfirm() {
    if (draft) {
      onChange(draft);
    }
    setOpen(false);
  }

  return (
    <>
      <div>
        <p className="text-sm font-medium">Avatar</p>
        <div className="mt-3 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Change avatar"
          >
            <AvatarPreview imageUrl={value} label={previewLabel} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors group-hover:bg-black/40">
              <Pencil className="size-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
          </button>
          <p className="text-sm text-muted-foreground">
            Click your avatar to choose another one.
          </p>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h2 id={titleId} className="text-lg font-semibold">
              Choose an avatar
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Pick one for proposals and team activity.
            </p>

            <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {AVATAR_OPTIONS.map((option) => {
                const selected = draft === option.url;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      aria-label={`Select ${option.label} avatar`}
                      aria-pressed={selected}
                      onClick={() => setDraft(option.url)}
                      className={cn(
                        "overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-background transition-shadow hover:ring-primary/50",
                        selected ? "ring-primary" : "ring-transparent",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={option.url}
                        alt=""
                        className="size-12 object-cover sm:size-14"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!draft}
                onClick={handleConfirm}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Select
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
