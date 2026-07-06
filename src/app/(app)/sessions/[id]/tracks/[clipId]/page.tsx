"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MoreVertical, Trash2 } from "lucide-react";
import { ClipVersionReactions } from "@/components/ClipVersionReactions";
import { NeedsAttentionButton } from "@/components/NeedsAttentionButton";
import {
  SessionTrackNav,
  SessionTrackNavSkeleton,
  type SessionTrackNavItem,
} from "@/components/SessionTrackNav";
import { TrackPageLayout } from "@/components/TrackPageLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button, buttonClassName } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WaveformEditor, ClipPlaybackButtons, type PlaybackState } from "@/components/WaveformEditor";
import { SpotifyVolumeSlider } from "@/components/SpotifyVolumeSlider";
import { useClipPlayback } from "@/hooks/useClipPlayback";
import type { UploadedAudioMetadata } from "@/lib/uploaded-audio";
import { useSimulatedPlaybackProgress } from "@/hooks/useSimulatedPlaybackProgress";
import { useRecordSessionWork } from "@/hooks/useRecordSessionWork";
import { useTrackEditLock } from "@/hooks/useTrackEditLock";
import { mergeTrackEditingBy, useSessionTrackLocks } from "@/hooks/useSessionTrackLocks";
import { TrackPageSkeleton } from "@/components/page-skeletons";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import {
  useUnsavedLeaveGuard,
  type LeaveDestination,
} from "@/hooks/useUnsavedLeaveGuard";
import { readJsonResponse } from "@/lib/read-json-response";
import type { ClipReactionValue, VersionReactions } from "@/lib/clip-reactions";
import type { AttentionFlaggedBy } from "@/lib/track-attention";
import { errorToast } from "@/lib/error-toast";
import { msToLabel } from "@/lib/waveform";
import { cn } from "@/lib/utils";

function BackToTracksLink({
  sessionId,
  onNavigate,
}: {
  sessionId: string;
  onNavigate?: (href: string) => boolean;
}) {
  const href = `/sessions/${sessionId}/edit`;
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (onNavigate && !onNavigate(href)) {
          event.preventDefault();
        }
      }}
      className={cn(
        buttonClassName({ variant: "outline", size: "sm" }),
        "shrink-0 gap-1.5 border-primary/50 bg-primary/10 font-medium text-primary hover:bg-primary/15",
      )}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to tracks
    </Link>
  );
}

interface ClipVersion {
  id: string;
  startMs: number;
  endMs: number;
  createdAt: string;
  createdByUserId: string;
  createdByName: string;
  isCurrent: boolean;
  reactions: VersionReactions;
}

interface TrackDetail {
  sessionName: string;
  track: {
    id: string;
    spotifyTrackId: string;
    trackName: string;
    artistName: string;
    albumArtUrl: string | null;
    durationMs: number;
    position: number;
    defaultStartMs: number;
    defaultEndMs: number;
    hasUploadedAudio: boolean;
    uploadedAudio: UploadedAudioMetadata | null;
  };
  playbackRange: {
    startMs: number;
    endMs: number;
    editorName?: string;
    source: "saved" | "default";
    versionId?: string;
  };
  currentVersion: ClipVersion | null;
  versions: ClipVersion[];
  currentUserId: string;
  needsAttention: boolean;
  attentionFlaggedBy: AttentionFlaggedBy | null;
  attentionComment: string | null;
}

function savedRange(detail: TrackDetail) {
  if (detail.currentVersion) {
    return {
      startMs: detail.currentVersion.startMs,
      endMs: detail.currentVersion.endMs,
    };
  }
  return {
    startMs: detail.track.defaultStartMs,
    endMs: detail.track.defaultEndMs,
  };
}

function rangesEqual(
  a: { startMs: number; endMs: number },
  b: { startMs: number; endMs: number },
) {
  return a.startMs === b.startMs && a.endMs === b.endMs;
}

function formatVersionDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

type WebPlaybackHandlers = {
  onPreview: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSeek: (positionMs: number) => void;
};

function VersionHistoryItem({
  version,
  track,
  sessionId,
  clipId,
  onLoad,
  onDelete,
  deleteLoading,
  activePreviewKey,
  onPreviewActive,
  playback,
  onPlaybackChange,
  getWebPlaybackHandlers,
  playbackDisabled,
  className,
}: {
  version: ClipVersion;
  track: TrackDetail["track"];
  sessionId: string;
  clipId: string;
  onLoad: () => void;
  onDelete: () => void;
  deleteLoading: boolean;
  activePreviewKey: string | null;
  onPreviewActive: (key: string) => void;
  playback: PlaybackState | null;
  onPlaybackChange: React.Dispatch<React.SetStateAction<PlaybackState | null>>;
  getWebPlaybackHandlers: (startMs: number, endMs: number) => WebPlaybackHandlers;
  playbackDisabled: boolean;
  className?: string;
}) {
  const previewKey = `version-${version.id}`;
  const webHandlers = getWebPlaybackHandlers(version.startMs, version.endMs);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  return (
    <li className={className}>
      <div
        className={cn(
          "rounded-lg border p-3",
          version.isCurrent
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{version.createdByName}</p>
              {version.isCurrent && (
                <span className="text-xs font-medium text-emerald-600">Current</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              {formatVersionDate(version.createdAt)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {msToLabel(version.startMs)} – {msToLabel(version.endMs)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ClipPlaybackButtons
              startMs={version.startMs}
              endMs={version.endMs}
              previewKey={previewKey}
              activePreviewKey={activePreviewKey}
              onPreviewActive={onPreviewActive}
              onPreview={playbackDisabled ? undefined : webHandlers.onPreview}
              onPause={playbackDisabled ? undefined : webHandlers.onPause}
              onRestart={playbackDisabled ? undefined : webHandlers.onRestart}
              isPlaying={
                !!playback?.is_playing &&
                playback.item?.id === clipId &&
                activePreviewKey === previewKey
              }
            />
            <div ref={menuRef} className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Version actions"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                disabled={deleteLoading}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MoreVertical className="size-4" aria-hidden="true" />
              </Button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-secondary"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setMenuOpen(false);
                      onLoad();
                    }}
                  >
                    Load into editor
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <WaveformEditor
            readOnly
            compact
            hidePlaybackControls
            clipId={clipId}
            sessionId={sessionId}
            trackId={track.spotifyTrackId}
            trackName={track.trackName}
            artistName={track.artistName}
            durationMs={track.durationMs}
            startMs={version.startMs}
            endMs={version.endMs}
            previewKey={previewKey}
            activePreviewKey={activePreviewKey}
            onPreviewActive={onPreviewActive}
            playback={playback}
            onPlaybackChange={onPlaybackChange}
          />
        </div>
      </div>
    </li>
  );
}

function VersionHistoryList({
  versions,
  collapsed,
  track,
  sessionId,
  clipId,
  onLoad,
  onDelete,
  deletingVersionId,
  activePreviewKey,
  onPreviewActive,
  playback,
  onPlaybackChange,
  getWebPlaybackHandlers,
  playbackDisabled,
  onExpand,
}: {
  versions: ClipVersion[];
  collapsed: boolean;
  track: TrackDetail["track"];
  sessionId: string;
  clipId: string;
  onLoad: (version: ClipVersion) => void;
  onDelete: (versionId: string) => void;
  deletingVersionId: string | null;
  activePreviewKey: string | null;
  onPreviewActive: (key: string) => void;
  playback: PlaybackState | null;
  onPlaybackChange: React.Dispatch<React.SetStateAction<PlaybackState | null>>;
  getWebPlaybackHandlers: (startMs: number, endMs: number) => WebPlaybackHandlers;
  playbackDisabled: boolean;
  onExpand: () => void;
}) {
  function renderItem(version: ClipVersion, className?: string) {
    return (
      <VersionHistoryItem
        key={version.id}
        version={version}
        track={track}
        sessionId={sessionId}
        clipId={clipId}
        onLoad={() => onLoad(version)}
        onDelete={() => onDelete(version.id)}
        deleteLoading={deletingVersionId === version.id}
        activePreviewKey={activePreviewKey}
        onPreviewActive={onPreviewActive}
        playback={playback}
        onPlaybackChange={onPlaybackChange}
        getWebPlaybackHandlers={getWebPlaybackHandlers}
        playbackDisabled={playbackDisabled}
        className={className}
      />
    );
  }

  if (!collapsed) {
    return <ul className="space-y-3">{versions.map((version) => renderItem(version))}</ul>;
  }

  return (
    <div>
      <ul>{renderItem(versions[0])}</ul>
      <div className="relative mt-2 h-[4.75rem] overflow-hidden">
        <div className="pointer-events-none select-none opacity-80 blur-[2px]">
          <ul className="-mt-1">{renderItem(versions[1])}</ul>
        </div>
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={onExpand}
          >
            Show all ({versions.length})
          </button>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-background from-20% to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}

function UnsavedChangesDialog({
  open,
  saving,
  onCancel,
  onDiscard,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
      >
        <h2 id="unsaved-changes-title" className="text-lg font-semibold">
          Unsaved changes
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You have unsaved clip changes. Save them or discard them before leaving.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Stay on page
          </Button>
          <Button type="button" variant="outline" onClick={onDiscard} disabled={saving}>
            Discard changes
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TrackEditPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const clipId = params.clipId as string;
  const { data: authSession } = useSession();
  const currentUserId = authSession?.user?.id ?? null;
  useRecordSessionWork(sessionId);
  const lockState = useTrackEditLock(sessionId, clipId);
  const polledLocks = useSessionTrackLocks(sessionId);

  const [detail, setDetail] = useState<TrackDetail | null>(null);
  const [sessionTracks, setSessionTracks] = useState<SessionTrackNavItem[]>([]);
  const [tracksReady, setTracksReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const { loading, begin, end } = useDelayedLoading();
  const [error, setError] = useState<string | null>(null);
  const [draftStartMs, setDraftStartMs] = useState(0);
  const [draftEndMs, setDraftEndMs] = useState(0);
  const [draftInitialized, setDraftInitialized] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const [reactionLoadingVersionId, setReactionLoadingVersionId] = useState<string | null>(null);
  const [attentionLoading, setAttentionLoading] = useState(false);
  const [pendingHref, setPendingHref] = useState<LeaveDestination | null>(null);
  const [activePreviewKey, setActivePreviewKey] = useState<string | null>("editor");
  const [showAllVersions, setShowAllVersions] = useState(false);
  const clipPlayback = useClipPlayback({
    clipId: detail?.track.id ?? clipId,
    hasUploadedAudio: detail?.track.hasUploadedAudio ?? false,
    sessionId,
  });
  const playback = useSimulatedPlaybackProgress(clipPlayback.playback);
  const setPlayback = clipPlayback.setPlayback;

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}/tracks/${clipId}`);
    const data = await readJsonResponse<{ error?: string } & TrackDetail>(res);
    return { res, data };
  }, [clipId, sessionId]);

  const fetchSessionTracks = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const data = await readJsonResponse<{ tracks?: SessionTrackNavItem[] }>(res);
    if (res.ok && data.tracks) {
      return data.tracks;
    }
    return [];
  }, [sessionId]);

  useEffect(() => {
    if (lockState.status === "loading") {
      return;
    }

    let cancelled = false;
    setTracksReady(false);

    void fetchSessionTracks().then((tracks) => {
      if (cancelled) return;
      setSessionTracks(tracks);
      setTracksReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchSessionTracks, lockState.status, clipId]);

  useEffect(() => {
    if (lockState.status !== "ready") {
      return;
    }

    let cancelled = false;

    setInitialized(false);
    setDraftInitialized(false);
    setError(null);
    begin();

    async function loadDetail() {
      try {
        const detailResult = await fetchDetail();
        if (cancelled) return;

        const { res, data } = detailResult;
        if (!res.ok) {
          setError(data.error ?? "Failed to load track");
          setDetail(null);
        } else {
          setDetail(data);
          setError(null);
        }
        setInitialized(true);
      } catch {
        if (!cancelled) {
          setError("Failed to load track");
          setDetail(null);
          setInitialized(true);
        }
      } finally {
        if (!cancelled) {
          end();
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [begin, end, fetchDetail, lockState.status, clipId]);

  const mergedSessionTracks = useMemo(
    () => mergeTrackEditingBy(sessionTracks, polledLocks),
    [sessionTracks, polledLocks],
  );

  useEffect(() => {
    setActivePreviewKey("editor");
  }, [clipId]);

  useEffect(() => {
    setShowAllVersions(false);
  }, [clipId]);

  useEffect(() => {
    if (!detail) return;
    const range = savedRange(detail);
    setDraftStartMs(range.startMs);
    setDraftEndMs(range.endMs);
    setDraftInitialized(true);
  }, [detail, clipId]);

  const saved = useMemo(
    () => (detail ? savedRange(detail) : { startMs: 0, endMs: 0 }),
    [detail],
  );

  const isDirty =
    draftInitialized &&
    detail != null &&
    !rangesEqual(
      { startMs: draftStartMs, endMs: draftEndMs },
      saved,
    );

  const onLeaveAttempt = useCallback((destination: LeaveDestination) => {
    setPendingHref(destination);
  }, []);

  const { runHistoryLeave } = useUnsavedLeaveGuard(isDirty, onLeaveAttempt);

  const finishLeave = useCallback(
    (destination: LeaveDestination) => {
      if (destination === "back") {
        runHistoryLeave(() => window.history.go(-2));
        return;
      }
      router.push(destination);
    },
    [router, runHistoryLeave],
  );

  const saveVersion = useCallback(
    async (startMs: number, endMs: number) => {
      setSaveLoading(true);
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/tracks/${clipId}/proposal`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startMs, endMs }),
          },
        );
        const data = await readJsonResponse<{ error?: string } & TrackDetail>(res);
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to save");
        }
        setDetail(data);
        const tracks = await fetchSessionTracks();
        setSessionTracks(tracks);
        return true;
      } catch {
        return false;
      } finally {
        setSaveLoading(false);
      }
    },
    [clipId, fetchSessionTracks, sessionId],
  );

  const revertDraft = useCallback(() => {
    setDraftStartMs(saved.startMs);
    setDraftEndMs(saved.endMs);
  }, [saved.endMs, saved.startMs]);

  const loadVersionIntoEditor = useCallback((version: ClipVersion) => {
    setDraftStartMs(version.startMs);
    setDraftEndMs(version.endMs);
    setActivePreviewKey("editor");
  }, []);

  const deleteVersion = useCallback(
    async (versionId: string) => {
      setDeletingVersionId(versionId);
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/tracks/${clipId}/proposal/${versionId}`,
          { method: "DELETE" },
        );
        const data = await readJsonResponse<{ error?: string } & TrackDetail>(res);
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to delete version");
        }
        setDetail(data);
        const tracks = await fetchSessionTracks();
        setSessionTracks(tracks);
        if (activePreviewKey === `version-${versionId}`) {
          setActivePreviewKey("editor");
        }
      } catch {
        // Keep the list unchanged if delete fails.
      } finally {
        setDeletingVersionId(null);
      }
    },
    [activePreviewKey, clipId, fetchSessionTracks, sessionId],
  );

  const reactToVersion = useCallback(
    async (versionId: string, reaction: ClipReactionValue) => {
      setReactionLoadingVersionId(versionId);
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/tracks/${clipId}/versions/${versionId}/reaction`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reaction }),
          },
        );
        const data = await readJsonResponse<{ error?: string } & TrackDetail>(res);
        if (!res.ok) {
          errorToast(data.error ?? "Failed to save reaction");
          return;
        }
        setDetail(data);
      } catch {
        errorToast("Failed to save reaction");
      } finally {
        setReactionLoadingVersionId(null);
      }
    },
    [clipId, sessionId],
  );

  const flagNeedsAttention = useCallback(
    async (comment: string) => {
      setAttentionLoading(true);
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/tracks/${clipId}/attention`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ needsAttention: true, comment }),
          },
        );
        const data = await readJsonResponse<{ error?: string } & TrackDetail>(res);
        if (!res.ok) {
          errorToast(data.error ?? "Failed to update attention flag");
          return false;
        }
        setDetail(data);
        const tracks = await fetchSessionTracks();
        setSessionTracks(tracks);
        return true;
      } catch {
        errorToast("Failed to update attention flag");
        return false;
      } finally {
        setAttentionLoading(false);
      }
    },
    [clipId, fetchSessionTracks, sessionId],
  );

  const clearNeedsAttention = useCallback(
    async () => {
      setAttentionLoading(true);
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/tracks/${clipId}/attention`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ needsAttention: false }),
          },
        );
        const data = await readJsonResponse<{ error?: string } & TrackDetail>(res);
        if (!res.ok) {
          errorToast(data.error ?? "Failed to update attention flag");
          return;
        }
        setDetail(data);
        const tracks = await fetchSessionTracks();
        setSessionTracks(tracks);
      } catch {
        errorToast("Failed to update attention flag");
      } finally {
        setAttentionLoading(false);
      }
    },
    [clipId, fetchSessionTracks, sessionId],
  );

  const requestNavigation = useCallback(
    (href: string) => {
      if (!isDirty) {
        return true;
      }
      setPendingHref(href);
      return false;
    },
    [isDirty],
  );

  const handleDialogCancel = () => setPendingHref(null);

  const handleDialogDiscard = () => {
    revertDraft();
    const destination = pendingHref;
    setPendingHref(null);
    if (destination) {
      finishLeave(destination);
    }
  };

  const handleDialogSave = async () => {
    const destination = pendingHref;
    const ok = await saveVersion(draftStartMs, draftEndMs);
    if (!ok) return;
    setPendingHref(null);
    if (destination) {
      finishLeave(destination);
    }
  };

  function renderTrackNav(showSkeletonWhenEmpty: boolean) {
    if (sessionTracks.length > 0) {
      return (
        <SessionTrackNav
          sessionId={sessionId}
          currentTrackId={clipId}
          currentUserId={currentUserId}
          tracks={mergedSessionTracks}
          onBeforeNavigate={requestNavigation}
        />
      );
    }

    if (showSkeletonWhenEmpty) {
      return <SessionTrackNavSkeleton />;
    }

    return null;
  }

  function renderTrackToolbarSkeleton() {
    return (
      <div className="mb-4 flex h-8 items-center justify-between gap-3">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
    );
  }

  const pageReady = initialized && tracksReady && lockState.status === "ready";
  const trackNav = renderTrackNav(
    lockState.status !== "loading" && !tracksReady,
  );

  if (lockState.status === "loading") {
    return (
      <TrackPageLayout nav={trackNav}>
        {renderTrackToolbarSkeleton()}
        <TrackPageSkeleton contentOnly />
      </TrackPageLayout>
    );
  }

  if (lockState.status === "blocked") {
    return (
      <TrackPageLayout nav={trackNav}>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-lg font-medium">{lockState.editingBy.name} is editing this track</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Wait until they finish, or pick another track from the list.
          </p>
          <Link
            href={`/sessions/${sessionId}/edit`}
            className="mt-6 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Back to session
          </Link>
        </div>
      </TrackPageLayout>
    );
  }

  if (!pageReady) {
    if (loading) {
      return (
        <TrackPageLayout nav={trackNav}>
          {renderTrackToolbarSkeleton()}
          <TrackPageSkeleton contentOnly />
        </TrackPageLayout>
      );
    }
    return null;
  }

  if (error || !detail) {
    return (
      <TrackPageLayout nav={trackNav}>
        <div className="mb-4 flex h-8 items-center justify-between gap-3">
          <Breadcrumb
            className="h-8 min-w-0 flex-1"
            items={[
              { label: "Bingo sessions", href: "/sessions" },
              { label: "Session", href: `/sessions/${sessionId}/edit` },
            ]}
          />
          <BackToTracksLink sessionId={sessionId} onNavigate={requestNavigation} />
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error ?? "Track not found"}
        </div>
      </TrackPageLayout>
    );
  }

  const { track, versions } = detail;
  const hasSavedVersion = detail.currentVersion != null;
  const historyCollapsed = !showAllVersions && versions.length > 1;
  const playbackDisabled = !detail.track.hasUploadedAudio || !clipPlayback.ready;

  function getWebPlaybackHandlers(startMs: number, endMs: number): WebPlaybackHandlers {
    return {
      onPreview: () => {
        void clipPlayback.playOrResumeClip(track.id, startMs, endMs);
      },
      onPause: () => {
        void clipPlayback.pause();
      },
      onRestart: () => {
        void clipPlayback.restartClip(track.id, startMs, endMs);
      },
      onSeek: (positionMs: number) => {
        void clipPlayback.seekClip(positionMs, startMs, endMs);
      },
    };
  }

  const editorPlayback = getWebPlaybackHandlers(draftStartMs, draftEndMs);

  return (
    <div>
      <UnsavedChangesDialog
        open={pendingHref != null}
        saving={saveLoading}
        onCancel={handleDialogCancel}
        onDiscard={handleDialogDiscard}
        onSave={() => void handleDialogSave()}
      />

      <TrackPageLayout nav={trackNav}>
        <div className="mb-4 flex h-8 items-center justify-between gap-3">
            <Breadcrumb
              className="h-8 min-w-0 flex-1"
              items={[
                { label: "Bingo sessions", href: "/sessions" },
                {
                  label: detail.sessionName,
                  href: `/sessions/${sessionId}/edit`,
                },
                { label: track.trackName },
              ]}
            />
            <BackToTracksLink sessionId={sessionId} onNavigate={requestNavigation} />
          </div>

          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="text-sm text-zinc-500">Track {track.position + 1}</p>
              <h1 className="text-2xl font-semibold">{track.trackName}</h1>
              <p className="text-zinc-500">{track.artistName}</p>
            </div>
            <SpotifyVolumeSlider
              compact
              volume={clipPlayback.volume}
              onVolumeChange={clipPlayback.setVolume}
              disabled={playbackDisabled}
            />
          </div>

          <p className="mt-4 text-sm">
            <Link
              href={`/sessions/${sessionId}/edit?uploadAudio=1`}
              className="font-medium text-emerald-700 hover:underline dark:text-emerald-300"
            >
              Upload session audio
            </Link>
            <span className="text-zinc-500">
              {" "}
              on the session page to preview clips here.
            </span>
          </p>

          {clipPlayback.error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
              {clipPlayback.error}
            </div>
          )}

          <div className="mt-8 space-y-8">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-medium">
                  {hasSavedVersion ? "Clip editor" : "Default clip"}
                </h2>
                <div className="flex items-center gap-2">
                  {isDirty && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saveLoading}
                      onClick={revertDraft}
                    >
                      Revert
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={!isDirty || saveLoading}
                    onClick={() => void saveVersion(draftStartMs, draftEndMs)}
                  >
                    {saveLoading ? "Saving…" : "Save version"}
                  </Button>
                </div>
              </div>

              <WaveformEditor
                manualSave
                unsaved={isDirty}
                clipId={clipId}
                sessionId={sessionId}
                trackId={track.spotifyTrackId}
                trackName={track.trackName}
                artistName={track.artistName}
                albumArtUrl={track.albumArtUrl}
                durationMs={track.durationMs}
                startMs={draftStartMs}
                endMs={draftEndMs}
                onDraftChange={(startMs, endMs) => {
                  setDraftStartMs(startMs);
                  setDraftEndMs(endMs);
                }}
                previewKey="editor"
                activePreviewKey={activePreviewKey}
                onPreviewActive={setActivePreviewKey}
                playback={playback}
                onPlaybackChange={setPlayback}
                onPreview={playbackDisabled ? undefined : editorPlayback.onPreview}
                onPause={playbackDisabled ? undefined : editorPlayback.onPause}
                onRestart={playbackDisabled ? undefined : editorPlayback.onRestart}
                onSeek={playbackDisabled ? undefined : editorPlayback.onSeek}
                footer={
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <NeedsAttentionButton
                      needsAttention={detail.needsAttention}
                      flaggedBy={detail.attentionFlaggedBy}
                      attentionComment={detail.attentionComment}
                      trackName={track.trackName}
                      loading={attentionLoading}
                      onFlag={(comment) => void flagNeedsAttention(comment)}
                      onClear={() => void clearNeedsAttention()}
                    />
                    {detail.currentVersion ? (
                      <ClipVersionReactions
                        showVoters={false}
                        reactions={detail.currentVersion.reactions}
                        loading={reactionLoadingVersionId === detail.currentVersion.id}
                        disabled={isDirty}
                        onReact={(reaction) =>
                          void reactToVersion(detail.currentVersion!.id, reaction)
                        }
                      />
                    ) : null}
                  </div>
                }
              />
            </section>

            {versions.length > 0 && (
              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-medium">Version history</h2>
                  {versions.length > 1 && showAllVersions && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllVersions(false)}
                    >
                      Show less
                    </Button>
                  )}
                </div>
                <VersionHistoryList
                  versions={versions}
                  collapsed={historyCollapsed}
                  track={track}
                  sessionId={sessionId}
                  clipId={clipId}
                  onLoad={loadVersionIntoEditor}
                  onDelete={(versionId) => void deleteVersion(versionId)}
                  deletingVersionId={deletingVersionId}
                  activePreviewKey={activePreviewKey}
                  onPreviewActive={setActivePreviewKey}
                  playback={playback}
                  onPlaybackChange={setPlayback}
                  getWebPlaybackHandlers={getWebPlaybackHandlers}
                  playbackDisabled={playbackDisabled}
                  onExpand={() => setShowAllVersions(true)}
                />
              </section>
            )}
          </div>
      </TrackPageLayout>
    </div>
  );
}
