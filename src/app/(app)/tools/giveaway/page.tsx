"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileText, Gift, Upload, X } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { GiveawayAvatar } from "@/components/giveaway/GiveawayAvatar";
import { WinnerOverlay } from "@/components/giveaway/WinnerOverlay";
import { Button, buttonClassName } from "@/components/ui/button";
import {
  Dropzone,
  DropZoneArea,
  DropzoneFileList,
  DropzoneFileListItem,
  DropzoneMessage,
  DropzoneRemoveFile,
  DropzoneTrigger,
  useDropzone,
} from "@/components/ui/dropzone";
import {
  DRAW_ANIMATIONS,
  resolveDrawAnimationId,
  type DrawAnimationId,
} from "@/lib/giveaway/draw-animations";
import { eligibleEntries, normalizeHandle, pickOrderedWinners } from "@/lib/giveaway/entries";
import { mergeImportedComments, parseImportedComments } from "@/lib/giveaway/parse-import";
import type { GiveawayComment } from "@/lib/giveaway/types";
import { cn } from "@/lib/utils";

const ANIMATION_STORAGE_KEY = "giveaway-draw-animation";
const EXPORTCOMMENTS_SITE = "https://exportcomments.com/";
const MAX_CSV_BYTES = 15 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CsvDropzone({
  onCommentsChange,
}: {
  onCommentsChange: (comments: GiveawayComment[], source: string) => void;
}) {
  const dropzone = useDropzone<{ comments: GiveawayComment[]; name: string }>({
    onDropFile: async (file) => {
      const comments = parseImportedComments(await file.text());
      if (!comments.length) {
        return { status: "error" as const, error: "No comments found in this file." };
      }
      return { status: "success" as const, result: { comments, name: file.name } };
    },
    validation: {
      accept: {
        "text/csv": [".csv"],
        "text/plain": [".csv"],
        "application/vnd.ms-excel": [".csv"],
      },
      maxSize: MAX_CSV_BYTES,
    },
  });

  useEffect(() => {
    let merged: GiveawayComment[] = [];
    const names: string[] = [];
    for (const file of dropzone.fileStatuses) {
      if (file.status !== "success") continue;
      merged = mergeImportedComments(merged, file.result.comments);
      names.push(file.result.name);
    }
    onCommentsChange(merged, names.join(", "));
  }, [dropzone.fileStatuses, onCommentsChange]);

  return (
    <Dropzone {...dropzone}>
      <div>
        <DropZoneArea
          className={
            dropzone.isDragActive
              ? "min-h-40 border-dashed border-emerald-500 bg-emerald-50/60 p-0 dark:bg-emerald-950/30"
              : "min-h-40 border-dashed p-0"
          }
        >
          <DropzoneTrigger className="flex min-h-40 w-full flex-col items-center justify-center gap-2 bg-transparent px-6 py-8 text-center hover:bg-transparent">
            <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium">Drop CSV files here</span>
          </DropzoneTrigger>
        </DropZoneArea>
        <DropzoneMessage />
        <DropzoneFileList className="mt-3">
          {dropzone.fileStatuses.map((file) => (
            <DropzoneFileListItem
              key={file.id}
              file={file}
              className="flex-row items-center justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.file.size)}</p>
                </div>
              </div>
              <DropzoneRemoveFile variant="ghost" className="shrink-0">
                <X className="size-4" />
              </DropzoneRemoveFile>
            </DropzoneFileListItem>
          ))}
        </DropzoneFileList>
      </div>
    </Dropzone>
  );
}

export default function GiveawayPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [comments, setComments] = useState<GiveawayComment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [uniqueUsers, setUniqueUsers] = useState(true);
  const [requireTag, setRequireTag] = useState(true);
  const [animation, setAnimation] = useState<DrawAnimationId>("shuffle");

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [cast, setCast] = useState<GiveawayComment[]>([]);
  const [target, setTarget] = useState<GiveawayComment | null>(null);
  const [winner, setWinner] = useState<GiveawayComment | null>(null);
  const [backups, setBackups] = useState<GiveawayComment[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const targetRef = useRef<GiveawayComment | null>(null);
  targetRef.current = target;

  const handleDropzoneComments = useCallback((imported: GiveawayComment[], source: string) => {
    setComments(imported);
    setFileName(source || null);
    setExcluded(new Set());
    setWinner(null);
    setTarget(null);
    setBackups([]);
    setError(null);
  }, []);

  const entries = useMemo(() => {
    const filtered = comments.filter((comment) => !excluded.has(comment.id));
    return eligibleEntries(filtered, {
      uniqueUsers,
      requireTag,
    });
  }, [comments, excluded, uniqueUsers, requireTag]);

  useEffect(() => {
    const stored = resolveDrawAnimationId(localStorage.getItem(ANIMATION_STORAGE_KEY));
    if (stored) setAnimation(stored);
  }, []);

  function chooseAnimation(id: DrawAnimationId) {
    setAnimation(id);
    localStorage.setItem(ANIMATION_STORAGE_KEY, id);
  }

  function runDraw(pool: GiveawayComment[]) {
    if (!pool.length) return;
    const [selected, ...runnersUp] = pickOrderedWinners(
      pool,
      3,
      undefined,
      (entry) => normalizeHandle(entry.username),
    );
    setOverlayOpen(true);
    setCast(pool);
    setTarget(selected ?? null);
    setBackups(runnersUp);
    setWinner(null);
    setSpinning(true);
  }

  function openDrawDialog() {
    if (!entries.length) {
      setError("No eligible entries. Import a CSV or adjust the filters.");
      return;
    }
    setError(null);
    setOverlayOpen(true);
    setSpinning(false);
    setWinner(null);
    setTarget(null);
    setBackups([]);
    setCast(entries);
  }

  function handleSpinComplete() {
    setWinner(targetRef.current);
    setSpinning(false);
  }

  const overlayEntries = cast.length ? cast : entries;

  return (
    <div>
      <Breadcrumb className="mb-4" items={[{ label: "Tools", href: "/tools" }, { label: "Giveaway" }]} />
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
          <Gift className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Giveaway</h1>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Import comments</h2>
          <a
            href={EXPORTCOMMENTS_SITE}
            target="_blank"
            rel="noreferrer"
            className={buttonClassName({ variant: "outline", size: "sm" })}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Open ExportComments
          </a>
        </div>
        <CsvDropzone onCommentsChange={handleDropzoneComments} />
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-medium">Winner rules</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={uniqueUsers}
              onChange={(event) => setUniqueUsers(event.target.checked)}
            />
            One entry per person
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requireTag}
              onChange={(event) => setRequireTag(event.target.checked)}
            />
            Comment must contain a tag (@username)
          </label>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-medium">Draw style</h2>
        <p className="mt-1 text-sm text-zinc-500">Choose how the winner is revealed.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DRAW_ANIMATIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => chooseAnimation(option.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-colors",
                animation === option.id
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                  : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800",
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-0.5 block text-xs text-zinc-500">{option.description}</span>
            </button>
          ))}
        </div>
      </section>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {fileName
            ? `${fileName} · ${comments.length} comments · ${entries.length} eligible`
            : "No comments loaded yet."}
        </p>
        <Button onClick={openDrawDialog}>Pick a winner</Button>
      </div>

      {entries.length ? (
        <ul className="mt-4 max-h-80 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex gap-3 border-b border-zinc-100 px-4 py-2 text-sm last:border-b-0 dark:border-zinc-900"
            >
              <GiveawayAvatar url={entry.thumbnailUrl} username={entry.username} size="sm" />
              <div className="min-w-0">
                <span className="font-medium">@{entry.username}</span>
                {entry.text ? (
                  <span className="mt-0.5 block text-zinc-500">{entry.text}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {overlayOpen ? (
        <WinnerOverlay
          entries={overlayEntries}
          winner={winner}
          backups={backups}
          target={target}
          spinning={spinning}
          animation={animation}
          onClose={() => {
            setOverlayOpen(false);
            setSpinning(false);
          }}
          onStart={() => runDraw(entries)}
          onSpinComplete={handleSpinComplete}
        />
      ) : null}
    </div>
  );
}
