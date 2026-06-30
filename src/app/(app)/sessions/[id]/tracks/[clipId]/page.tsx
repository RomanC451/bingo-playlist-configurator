"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { WaveformEditor } from "@/components/WaveformEditor";
import type { PlaybackState } from "@/components/WaveformEditor";
import { useSessionPlayback } from "@/hooks/useSessionPlayback";
import { useRecordSessionWork } from "@/hooks/useRecordSessionWork";
import { TrackPageSkeleton } from "@/components/page-skeletons";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { readJsonResponse } from "@/lib/read-json-response";
import {
  featuredSectionTitle,
  resolveTrackProposalLayout,
  type LayoutProposal,
} from "@/lib/track-proposal-layout";
import { msToLabel } from "@/lib/waveform";

interface Proposal {
  id: string;
  userId: string;
  userName: string;
  startMs: number;
  endMs: number;
  voteCount: number;
  isWinner: boolean;
  isMine: boolean;
  createdAt: string;
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
  };
  playbackRange: {
    startMs: number;
    endMs: number;
    proposerName?: string;
    voteCount: number;
    source: "vote" | "default";
    proposalId?: string;
  };
  proposals: Proposal[];
  userVote: { proposalId: string } | null;
  userProposal: { id: string; startMs: number; endMs: number } | null;
}

function StarIcon({
  filled,
  className = "h-5 w-5",
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} ${filled ? "fill-amber-400 text-amber-400" : "fill-none stroke-current text-zinc-400"}`}
      strokeWidth={filled ? 0 : 1.5}
      aria-hidden
    >
      <path
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      />
    </svg>
  );
}

function VoteStar({
  proposal,
  userVote,
  voteLoading,
  onVote,
  onClearVote,
}: {
  proposal: Pick<LayoutProposal, "id">;
  userVote: { proposalId: string } | null;
  voteLoading: string | null;
  onVote: (proposalId: string) => void;
  onClearVote: () => void;
}) {
  const isVoted = userVote?.proposalId === proposal.id;
  const loading =
    voteLoading !== null &&
    (voteLoading === "clear" ? isVoted : voteLoading === proposal.id);

  return (
    <button
      type="button"
      disabled={voteLoading !== null}
      onClick={() => void (isVoted ? onClearVote() : onVote(proposal.id))}
      aria-label={isVoted ? "Remove vote" : "Vote for this proposal"}
      title={isVoted ? "Remove vote" : "Vote for this proposal"}
      className="shrink-0 rounded-lg p-1 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
    >
      {loading ? (
        <span className="flex h-5 w-5 items-center justify-center text-xs text-zinc-400">…</span>
      ) : (
        <StarIcon filled={isVoted} />
      )}
    </button>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="mb-3 text-lg font-medium">{title}</h2>;
}

function ProposalCard({
  proposal,
  track,
  sessionId,
  clipId,
  userVote,
  voteLoading,
  onVote,
  onClearVote,
  previewKey,
  activePreviewKey,
  onPreviewActive,
  playback,
  onPlaybackChange,
  readOnly = true,
  compact = false,
  showMeta,
  showVote = false,
  saveUrl,
  onUpdate,
  albumArtUrl,
  onRemove,
  removeLoading = false,
}: {
  proposal: LayoutProposal;
  track: TrackDetail["track"];
  sessionId: string;
  clipId: string;
  userVote: { proposalId: string } | null;
  voteLoading: string | null;
  onVote: (proposalId: string) => void;
  onClearVote: () => void;
  previewKey: string;
  activePreviewKey: string | null;
  onPreviewActive: (key: string) => void;
  playback: PlaybackState | null;
  onPlaybackChange: React.Dispatch<React.SetStateAction<PlaybackState | null>>;
  readOnly?: boolean;
  compact?: boolean;
  showMeta?: boolean;
  showVote?: boolean;
  saveUrl?: string;
  onUpdate?: (startMs: number, endMs: number) => void;
  albumArtUrl?: string | null;
  onRemove?: () => void;
  removeLoading?: boolean;
}) {
  const showProposalMeta = showMeta ?? !proposal.isDefault;
  const showCardHeader = showProposalMeta || onRemove || showVote;

  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 ${
        proposal.isWinner
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      {showCardHeader && (
        <div className="mb-3 flex items-start gap-2">
          {showProposalMeta ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{proposal.userName}</p>
              <p className="text-xs text-zinc-500">
                {msToLabel(proposal.startMs)} – {msToLabel(proposal.endMs)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                {proposal.voteCount} vote{proposal.voteCount === 1 ? "" : "s"}
                {proposal.isWinner && (
                  <span className="ml-1.5 text-emerald-600">· Team pick</span>
                )}
              </p>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex shrink-0 items-center gap-1">
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={removeLoading}
                onClick={() => void onRemove()}
                aria-label="Remove proposal"
                title="Remove proposal"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            )}
            {showVote && (
              <VoteStar
                proposal={proposal}
                userVote={userVote}
                voteLoading={voteLoading}
                onVote={onVote}
                onClearVote={onClearVote}
              />
            )}
          </div>
        </div>
      )}
      <WaveformEditor
        readOnly={readOnly}
        compact={compact}
        clipId={clipId}
        sessionId={sessionId}
        saveUrl={saveUrl}
        onUpdate={onUpdate}
        trackId={track.spotifyTrackId}
        trackName={track.trackName}
        artistName={track.artistName}
        albumArtUrl={albumArtUrl}
        durationMs={track.durationMs}
        startMs={proposal.startMs}
        endMs={proposal.endMs}
        previewKey={previewKey}
        activePreviewKey={activePreviewKey}
        onPreviewActive={onPreviewActive}
        playback={playback}
        onPlaybackChange={onPlaybackChange}
      />
    </div>
  );
}

export default function TrackEditPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const clipId = params.clipId as string;
  useRecordSessionWork(sessionId);
  const [detail, setDetail] = useState<TrackDetail | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { loading, begin, end } = useDelayedLoading();
  const [error, setError] = useState<string | null>(null);
  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [activePreviewKey, setActivePreviewKey] = useState<string | null>(null);
  const { playback, setPlayback, rateLimitMessage } = useSessionPlayback(sessionId);

  const loadDetail = useCallback(async () => {
    begin();
    try {
      const res = await fetch(`/api/sessions/${sessionId}/tracks/${clipId}`);
      const data = await readJsonResponse<{ error?: string } & TrackDetail>(res);
      if (!res.ok) {
        setError(data.error ?? "Failed to load track");
        setDetail(null);
      } else {
        setDetail(data);
        setError(null);
      }
      setInitialized(true);
    } catch {
      setError("Failed to load track");
      setDetail(null);
      setInitialized(true);
    } finally {
      end();
    }
  }, [begin, clipId, end, sessionId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  function handleProposalUpdate(startMs: number, endMs: number) {
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        userProposal: prev.userProposal
          ? { ...prev.userProposal, startMs, endMs }
          : { id: "pending", startMs, endMs },
        proposals: prev.proposals.map((p) =>
          p.isMine ? { ...p, startMs, endMs } : p,
        ),
      };
    });
    void loadDetail();
  }

  async function voteFor(proposalId: string) {
    setVoteLoading(proposalId);
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/tracks/${clipId}/vote`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalId }),
        },
      );
      if (res.ok) {
        setDetail(await readJsonResponse(res));
      }
    } finally {
      setVoteLoading(null);
    }
  }

  async function clearVote() {
    setVoteLoading("clear");
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/tracks/${clipId}/vote`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setDetail(await readJsonResponse(res));
      }
    } finally {
      setVoteLoading(null);
    }
  }

  async function removeProposal() {
    setRemoveLoading(true);
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/tracks/${clipId}/proposal`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setDetail(await readJsonResponse(res));
      }
    } finally {
      setRemoveLoading(false);
    }
  }

  const layout = useMemo(() => {
    if (!detail) return null;
    return resolveTrackProposalLayout(
      detail.track,
      detail.playbackRange,
      detail.proposals,
    );
  }, [detail]);

  if (!initialized) {
    if (loading) return <TrackPageSkeleton />;
    return null;
  }

  if (error || !detail || !layout) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error ?? "Track not found"}
      </div>
    );
  }

  const { track, playbackRange, userProposal } = detail;
  const { featured, teamSidebar, showYourProposal } = layout;
  const editorStart = userProposal?.startMs ?? track.defaultStartMs;
  const editorEnd = userProposal?.endMs ?? track.defaultEndMs;

  const sharedProposalProps = {
    track,
    sessionId,
    clipId,
    userVote: detail.userVote,
    voteLoading,
    onVote: voteFor,
    onClearVote: clearVote,
    activePreviewKey,
    onPreviewActive: setActivePreviewKey,
    playback,
    onPlaybackChange: setPlayback,
  };

  const featuredIsEditable = featured.isMine && !featured.isDefault;
  const removeProposalHandler = userProposal ? () => void removeProposal() : undefined;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Bingo sessions", href: "/sessions" },
          {
            label: detail.sessionName,
            href: `/sessions/${sessionId}/edit`,
          },
          { label: track.trackName },
        ]}
      />

      <div>
        <p className="text-sm text-zinc-500">Track {track.position + 1}</p>
        <h1 className="text-2xl font-semibold">{track.trackName}</h1>
        <p className="text-zinc-500">{track.artistName}</p>
        {playbackRange.source === "vote" ? (
          <p className="mt-2 text-sm text-zinc-500">
            Team plays{" "}
            <span className="text-zinc-700 dark:text-zinc-300">
              {msToLabel(playbackRange.startMs)} – {msToLabel(playbackRange.endMs)}
            </span>
            {" · "}
            {playbackRange.proposerName}
            {" · "}
            {playbackRange.voteCount}
            <StarIcon filled className="ml-0.5 inline h-3.5 w-3.5 align-text-bottom" />
          </p>
        ) : featured.isDefault ? (
          <p className="mt-2 text-sm text-zinc-500">
            Playing the default clip — propose your own range below
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            Featured proposal from {featured.userName} — star a proposal to pick what the team plays
          </p>
        )}
      </div>

      {rateLimitMessage && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {rateLimitMessage}
        </div>
      )}

      <div
        className={`mt-8 grid gap-8 ${teamSidebar.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_min(22rem,32%)]" : ""}`}
      >
        <div className="min-w-0 space-y-8">
          <section>
            <SectionHeading title={featuredSectionTitle(featured)} />
            <ProposalCard
              {...sharedProposalProps}
              proposal={featured}
              previewKey="featured"
              readOnly={!featuredIsEditable}
              showMeta={!featured.isDefault}
              showVote={!featured.isDefault && !featured.isMine}
              onRemove={featuredIsEditable ? removeProposalHandler : undefined}
              removeLoading={removeLoading}
              saveUrl={
                featuredIsEditable
                  ? `/api/sessions/${sessionId}/tracks/${clipId}/proposal`
                  : undefined
              }
              onUpdate={featuredIsEditable ? handleProposalUpdate : undefined}
              albumArtUrl={featured.isDefault || featuredIsEditable ? track.albumArtUrl : undefined}
            />
          </section>

          {showYourProposal && (
            <section>
              <SectionHeading title="Your proposal" />
              <ProposalCard
                {...sharedProposalProps}
                proposal={{
                  id: userProposal?.id ?? "mine",
                  userName: "You",
                  startMs: editorStart,
                  endMs: editorEnd,
                  voteCount:
                    detail.proposals.find((p) => p.isMine)?.voteCount ?? 0,
                  isWinner: false,
                  isMine: true,
                  isDefault: false,
                }}
                previewKey="mine"
                readOnly={false}
                showMeta={false}
                onRemove={removeProposalHandler}
                removeLoading={removeLoading}
                saveUrl={`/api/sessions/${sessionId}/tracks/${clipId}/proposal`}
                onUpdate={handleProposalUpdate}
                albumArtUrl={track.albumArtUrl}
              />
            </section>
          )}
        </div>

        {teamSidebar.length > 0 && (
          <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <h2 className="mb-3 text-lg font-medium">Team proposals</h2>
            <ul className="space-y-3">
              {teamSidebar.map((proposal) => (
                <li key={proposal.id}>
                  <ProposalCard
                    {...sharedProposalProps}
                    proposal={proposal}
                    previewKey={`proposal-${proposal.id}`}
                    compact
                    showMeta
                    showVote
                  />
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
