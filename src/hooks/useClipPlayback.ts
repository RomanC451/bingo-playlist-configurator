"use client";

import { useCallback, useMemo } from "react";
import { publicGuessAudioStreamPath, sessionTrackAudioStreamPath } from "@/lib/uploaded-audio";
import { useHtmlAudioPlayer } from "@/hooks/useHtmlAudioPlayer";

export type ClipPlaybackOptions = {
  clipId: string | null;
  hasUploadedAudio: boolean;
  sessionId?: string;
  shareToken?: string | null;
  guestId?: string | null;
  /** Cache-bust stream URL / player when uploaded audio is replaced. */
  audioRevision?: string | null;
};

export function useClipPlayback({
  clipId,
  hasUploadedAudio,
  sessionId,
  shareToken,
  guestId,
  audioRevision = null,
}: ClipPlaybackOptions) {
  const useUploadedAudio = hasUploadedAudio && Boolean(clipId);

  const getStreamUrl = useCallback(
    (targetClipId: string) => {
      let base: string;
      if (shareToken) {
        base = publicGuessAudioStreamPath(shareToken, targetClipId, guestId);
      } else if (sessionId) {
        base = sessionTrackAudioStreamPath(sessionId, targetClipId);
      } else {
        throw new Error("Missing stream context");
      }
      if (!audioRevision) return base;
      const separator = base.includes("?") ? "&" : "?";
      return `${base}${separator}v=${encodeURIComponent(audioRevision)}`;
    },
    [audioRevision, guestId, sessionId, shareToken],
  );

  const htmlPlayer = useHtmlAudioPlayer({
    getStreamUrl,
    enabled: useUploadedAudio,
    audioRevision,
  });

  const playClip = useCallback(
    async (targetClipId: string, startMs: number, endMs: number) => {
      if (!targetClipId) {
        throw new Error("Upload audio to preview this clip");
      }
      await htmlPlayer.playClip(targetClipId, startMs, endMs);
    },
    [htmlPlayer],
  );

  const playOrResumeClip = useCallback(
    async (targetClipId: string, startMs: number, endMs: number) => {
      if (!targetClipId) {
        throw new Error("Upload audio to preview this clip");
      }
      await htmlPlayer.playOrResumeClip(targetClipId, startMs, endMs);
    },
    [htmlPlayer],
  );

  const restartClip = useCallback(
    async (targetClipId: string, startMs: number, endMs: number) => {
      await playClip(targetClipId, startMs, endMs);
    },
    [playClip],
  );

  const seekClip = useCallback(
    async (positionMs: number, startMs: number, endMs: number) => {
      const targetClipId = clipId;
      if (!targetClipId) {
        throw new Error("Upload audio to preview this clip");
      }
      await htmlPlayer.seekClip(targetClipId, positionMs, startMs, endMs);
    },
    [clipId, htmlPlayer],
  );

  return useMemo(
    () => ({
      playback: htmlPlayer.playback,
      setPlayback: htmlPlayer.setPlayback,
      error: htmlPlayer.error,
      actionLoading: htmlPlayer.actionLoading,
      playClip,
      playOrResumeClip,
      pause: htmlPlayer.pause,
      resume: htmlPlayer.resume,
      restartClip,
      seekClip,
      volume: htmlPlayer.volume,
      setVolume: htmlPlayer.setVolume,
      ready: useUploadedAudio && htmlPlayer.ready,
      source: "upload" as const,
      usesUploadedAudio: useUploadedAudio,
      htmlPlayer,
    }),
    [htmlPlayer, playClip, playOrResumeClip, restartClip, seekClip, useUploadedAudio],
  );
}
