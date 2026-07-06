"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  detectAssignmentConflicts,
  fuzzyMatchAudioFiles,
  getFileId,
  isMp3File,
  type MatchConflict,
} from "@/lib/audio-file-matching";
import { runWithConcurrency, uploadTrackAudioFile } from "@/lib/upload-track-audio";

export type SessionAudioUploadTrack = {
  id: string;
  trackName: string;
  artistName: string;
  hasUploadedAudio: boolean;
};

interface SessionAudioUploadDialogProps {
  open: boolean;
  sessionId: string;
  tracks: SessionAudioUploadTrack[];
  initialFiles?: File[];
  onClose: () => void;
  onComplete: () => void;
}

function buildAssignments(
  files: File[],
  tracks: SessionAudioUploadTrack[],
  previous?: Record<string, string>,
) {
  const fuzzy = fuzzyMatchAudioFiles(files, tracks);
  const fileIds = new Set(files.map(getFileId));
  const next: Record<string, string> = {};

  for (const track of tracks) {
    const kept = previous?.[track.id];
    if (kept && fileIds.has(kept)) {
      next[track.id] = kept;
      continue;
    }
    next[track.id] = fuzzy.assignments[track.id] ?? "";
  }

  return next;
}

function collectConflicts(
  files: File[],
  tracks: SessionAudioUploadTrack[],
  assignments: Record<string, string>,
): MatchConflict[] {
  const manual = detectAssignmentConflicts(assignments);
  if (manual.length > 0) return manual;

  const fuzzy = fuzzyMatchAudioFiles(files, tracks);
  return fuzzy.conflicts.filter((conflict) => {
    if (conflict.type === "duplicate_track" && conflict.clipId) {
      return !assignments[conflict.clipId];
    }
    if (conflict.type === "ambiguous_file") {
      const assignedClipId = Object.entries(assignments).find(
        ([, fileId]) => fileId === conflict.fileId,
      )?.[0];
      return !assignedClipId;
    }
    return true;
  });
}

export function SessionAudioUploadDialog({
  open,
  sessionId,
  tracks,
  initialFiles = [],
  onClose,
  onComplete,
}: SessionAudioUploadDialogProps) {
  const titleId = useId();
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const uploadProgressRef = useRef({ done: 0, total: 0 });
  const [files, setFiles] = useState<File[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileById = useMemo(
    () => new Map(files.map((file) => [getFileId(file), file])),
    [files],
  );

  const matchedCount = useMemo(
    () => tracks.filter((track) => Boolean(assignments[track.id])).length,
    [tracks, assignments],
  );

  const unmatchedTracks = useMemo(
    () => tracks.filter((track) => !assignments[track.id]),
    [tracks, assignments],
  );

  const allTracksMatched = tracks.length > 0 && matchedCount === tracks.length;

  const conflicts = useMemo(
    () => collectConflicts(files, tracks, assignments),
    [files, tracks, assignments],
  );

  const assignedFileIds = useMemo(
    () => new Set(Object.values(assignments).filter(Boolean)),
    [assignments],
  );

  const unassignedFiles = useMemo(
    () => files.filter((file) => !assignedFileIds.has(getFileId(file))),
    [files, assignedFileIds],
  );

  const replacementCount = useMemo(
    () =>
      tracks.filter(
        (track) => track.hasUploadedAudio && Boolean(assignments[track.id]),
      ).length,
    [tracks, assignments],
  );

  const canSubmit =
    !uploading && allTracksMatched && conflicts.length === 0;

  const uploadPercent =
    uploadProgress.total > 0
      ? Math.min(100, (uploadProgress.done / uploadProgress.total) * 100)
      : 0;

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const mp3Files = initialFiles.filter(isMp3File);
      setFiles(mp3Files);
      setAssignments(buildAssignments(mp3Files, tracks));
      setUploadErrors({});
      setSubmitError(null);
      setConfirmReplaceOpen(false);
      uploadProgressRef.current = { done: 0, total: 0 };
      setUploadProgress({ done: 0, total: 0 });
      setUploading(false);
    }

    if (!open && wasOpenRef.current) {
      uploadProgressRef.current = { done: 0, total: 0 };
      setUploadProgress({ done: 0, total: 0 });
      setUploading(false);
    }

    wasOpenRef.current = open;
  }, [open, initialFiles, tracks]);

  const handleAddMoreFiles = useCallback(
    (incoming: File[]) => {
      const mp3Files = incoming.filter(isMp3File);
      if (mp3Files.length === 0) return;
      setFiles((current) => {
        const merged = [...current];
        const seen = new Set(current.map(getFileId));
        for (const file of mp3Files) {
          const id = getFileId(file);
          if (!seen.has(id)) {
            merged.push(file);
            seen.add(id);
          }
        }
        setAssignments((prev) => buildAssignments(merged, tracks, prev));
        return merged;
      });
      setSubmitError(null);
    },
    [tracks],
  );

  const handleAssignmentChange = useCallback((clipId: string, fileId: string) => {
    setAssignments((prev) => ({ ...prev, [clipId]: fileId }));
    setUploadErrors((prev) => {
      if (!prev[clipId]) return prev;
      const next = { ...prev };
      delete next[clipId];
      return next;
    });
  }, []);

  const runUpload = useCallback(async () => {
    setUploading(true);
    setSubmitError(null);
    setUploadErrors({});

    const jobs = tracks
      .filter((track) => Boolean(assignments[track.id]))
      .map((track) => ({
        track,
        file: fileById.get(assignments[track.id])!,
      }));

    const total = jobs.length;
    const initialProgress = { done: 0, total };
    uploadProgressRef.current = initialProgress;
    setUploadProgress({ ...initialProgress });
    const errors: Record<string, string> = {};

    try {
      await runWithConcurrency(jobs, 3, async (job) => {
        try {
          await uploadTrackAudioFile({
            sessionId,
            clipId: job.track.id,
            file: job.file,
          });
        } catch (err) {
          errors[job.track.id] = err instanceof Error ? err.message : "Upload failed";
        } finally {
          const nextProgress = {
            total,
            done: uploadProgressRef.current.done + 1,
          };
          uploadProgressRef.current = nextProgress;
          setUploadProgress({ ...nextProgress });
        }
      });

      if (Object.keys(errors).length > 0) {
        setUploadErrors(errors);
        setSubmitError("Some uploads failed. Fix errors and try again.");
        return;
      }

      onClose();
      onComplete();
    } finally {
      setUploading(false);
    }
  }, [assignments, fileById, onClose, onComplete, sessionId, tracks]);

  function handleSubmitClick() {
    if (!canSubmit) return;
    if (replacementCount > 0) {
      setConfirmReplaceOpen(true);
      return;
    }
    void runUpload();
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
        <button
          type="button"
          aria-label="Close dialog"
          className="absolute inset-0 bg-black/40"
          disabled={uploading}
          onClick={() => {
            if (!uploading) onClose();
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        >
          <div className="border-b border-border px-5 py-4">
            <h2 id={titleId} className="text-lg font-semibold">
              Upload session audio
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {allTracksMatched
                ? "Every track is matched to an MP3. Submit to upload all files to storage."
                : "Assign an MP3 to each unmatched track below, then submit to upload."}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span>
                Matched: {matchedCount} / {tracks.length}
              </span>
              <span>{files.length} files selected</span>
              {!allTracksMatched ? (
                <span>Unmatched tracks: {unmatchedTracks.length}</span>
              ) : null}
              <span>Unassigned files: {unassignedFiles.length}</span>
              {conflicts.length > 0 ? (
                <span className="text-amber-700 dark:text-amber-300">
                  Conflicts: {conflicts.length}
                </span>
              ) : null}
            </div>
            {uploading ? (
              <div className="mt-3">
                <div
                  className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuemin={0}
                  aria-valuemax={uploadProgress.total}
                  aria-valuenow={uploadProgress.done}
                >
                  <div
                    className="h-full bg-emerald-500 transition-[width] duration-300 ease-out"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Uploading {uploadProgress.done} / {uploadProgress.total}…
                </p>
              </div>
            ) : null}
            {submitError ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{submitError}</p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {allTracksMatched ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-900 dark:bg-emerald-950">
                <p className="font-medium text-emerald-800 dark:text-emerald-200">
                  All tracks matched
                </p>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                  Every track has been paired with an MP3 file. Press Start uploading to send them to
                  storage.
                </p>
              </div>
            ) : (
              <>
                {conflicts.length > 0 ? (
                  <div className="mb-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    {conflicts.map((conflict) => (
                      <p key={`${conflict.type}-${conflict.fileId}-${conflict.clipId ?? ""}`}>
                        {conflict.message}
                      </p>
                    ))}
                  </div>
                ) : null}

                {unmatchedTracks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No unmatched tracks.</p>
                ) : (
                  <div className="space-y-2">
                    {unmatchedTracks.map((track, index) => {
                      const selectedFileId = assignments[track.id] ?? "";
                      const selectedFile = selectedFileId ? fileById.get(selectedFileId) : null;
                      const rowError = uploadErrors[track.id];

                      return (
                        <div
                          key={track.id}
                          className="rounded-lg border border-border bg-card p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">Track {index + 1}</p>
                              <p className="font-medium">{track.trackName}</p>
                              <p className="text-sm text-muted-foreground">{track.artistName}</p>
                              {track.hasUploadedAudio && selectedFile ? (
                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                  Will replace existing upload
                                </p>
                              ) : null}
                              {rowError ? (
                                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                  {rowError}
                                </p>
                              ) : null}
                            </div>
                            <div className="min-w-[220px] flex-1 sm:max-w-xs">
                              <label className="sr-only" htmlFor={`audio-file-${track.id}`}>
                                Audio file for {track.trackName}
                              </label>
                              <select
                                id={`audio-file-${track.id}`}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={selectedFileId}
                                disabled={uploading}
                                onChange={(event) =>
                                  handleAssignmentChange(track.id, event.target.value)
                                }
                              >
                                <option value="">Select MP3…</option>
                                {files.map((file) => {
                                  const fileId = getFileId(file);
                                  const usedElsewhere =
                                    assignedFileIds.has(fileId) && fileId !== selectedFileId;
                                  return (
                                    <option key={fileId} value={fileId} disabled={usedElsewhere}>
                                      {file.name}
                                      {usedElsewhere ? " (assigned elsewhere)" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                              {selectedFile ? (
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {selectedFile.name}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {unassignedFiles.length > 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-border p-3">
                    <p className="text-sm font-medium">Unassigned files</p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {unassignedFiles.map((file) => (
                        <li key={getFileId(file)} className="truncate">
                          {file.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4">
            {!allTracksMatched ? (
              <div>
                <input
                  ref={addMoreInputRef}
                  type="file"
                  accept=".mp3,audio/mpeg"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const picked = [...(event.target.files ?? [])];
                    handleAddMoreFiles(picked);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => addMoreInputRef.current?.click()}
                >
                  Add more files
                </Button>
              </div>
            ) : (
              <div />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="button" disabled={!canSubmit} onClick={handleSubmitClick}>
                {uploading ? "Uploading…" : "Start uploading"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {confirmReplaceOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Close confirmation"
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmReplaceOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Replace existing audio?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {replacementCount} track{replacementCount === 1 ? "" : "s"} already have uploaded
              audio. Submitting will replace them with the newly assigned files.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmReplaceOpen(false)}>
                Go back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setConfirmReplaceOpen(false);
                  void runUpload();
                }}
              >
                Replace and upload
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
