"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { DeleteSessionDialog } from "@/components/DeleteSessionDialog";
import { SpotifyConnectionCard } from "@/components/SpotifyConnectionCard";
import {
  useAlternatingMemberPhotos,
  type MemberUser,
} from "@/components/MemberAvatarStack";
import {
  accentForSession,
  SessionCard,
  type SessionCardData,
} from "@/components/SessionCard";
import { SessionTeamProgressDialog } from "@/components/SessionTeamProgressDialog";
import { SessionsPageSkeleton } from "@/components/page-skeletons";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { errorMessageFromBody } from "@/lib/api-errors";
import { isTeamManagerRole, type TeamRoleValue } from "@/lib/team-client";
import { readJsonResponse } from "@/lib/read-json-response";

function SessionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: authSession } = useSession();
  const currentUserId = authSession?.user?.id ?? null;
  const [sessions, setSessions] = useState<SessionCardData[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<MemberUser[]>([]);
  const showMemberPhotos = useAlternatingMemberPhotos();
  const [teamSpotifyLinked, setTeamSpotifyLinked] = useState(false);
  const [spotifyConfigured, setSpotifyConfigured] = useState(true);
  const [clientIdHint, setClientIdHint] = useState<string | null>(null);
  const [spotifyRedirectUri, setSpotifyRedirectUri] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { loading, begin, end } = useDelayedLoading();
  const [flash, setFlash] = useState<{
    spotify: string | null;
    spotifyError: string | null;
    spotifyDetail: string | null;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [teamProgressSessionId, setTeamProgressSessionId] = useState<string | null>(null);
  const [currentUserTeamRole, setCurrentUserTeamRole] = useState<TeamRoleValue | null>(null);

  const loadAll = useCallback(async () => {
    begin();
    try {
      const teamsRes = await fetch("/api/teams");
      let teamId: string | null = null;
      let nextTeamMembers: MemberUser[] = [];
      if (teamsRes.ok) {
        const teamsData = await readJsonResponse<{
          activeTeamId: string | null;
          teams: {
            id: string;
            members: { role: TeamRoleValue; user: MemberUser }[];
          }[];
        }>(teamsRes);
        teamId = teamsData.activeTeamId;
        const activeTeam = teamsData.teams.find((team) => team.id === teamId);
        nextTeamMembers = activeTeam?.members.map((member) => member.user) ?? [];
        const myMembership = activeTeam?.members.find(
          (member) => member.user.id === currentUserId,
        );
        setCurrentUserTeamRole(myMembership?.role ?? null);
      }

      const sessionsQuery = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
      const spotifyUrl = teamId
        ? `/api/spotify/status?teamId=${encodeURIComponent(teamId)}`
        : null;
      const [sessionsRes, spotifyRes] = await Promise.all([
        fetch(`/api/sessions${sessionsQuery}`),
        spotifyUrl ? fetch(spotifyUrl) : Promise.resolve(null),
      ]);

      const rawSessions = sessionsRes.ok
        ? await readJsonResponse<
            {
              id: string;
              name: string;
              spotifyPlaylistName: string | null;
              playlistImageUrl: string | null;
              defaultClipDurationMs: number;
              updatedAt: string;
              ownerName: string;
              _count: { trackClips: number };
              userReviewProgress: {
                reviewed: number;
                remaining: number;
                total: number;
              };
            }[]
          >(sessionsRes)
        : [];
      const nextSessions: SessionCardData[] = rawSessions.map((session) => ({
        id: session.id,
        name: session.name,
        playlist: session.spotifyPlaylistName ?? "Spotify playlist",
        trackCount: session._count.trackClips,
        owner: session.ownerName,
        clipRange: `${session.defaultClipDurationMs / 1000}s`,
        playlistImageUrl: session.playlistImageUrl,
        accent: accentForSession(session.id),
        userReviewProgress: session.userReviewProgress,
      }));
      let nextSpotifyConfigured = true;
      let nextTeamSpotifyLinked = false;
      let nextClientIdHint: string | null = null;
      let nextSpotifyRedirectUri: string | null = null;
      if (spotifyRes?.ok) {
        const data = await spotifyRes.json();
        nextSpotifyConfigured = data.configured;
        nextTeamSpotifyLinked = data.linked === true;
        nextClientIdHint = data.clientIdHint ?? null;
        nextSpotifyRedirectUri = data.redirectUri ?? null;
      }

      setActiveTeamId(teamId);
      setTeamMembers(nextTeamMembers);
      setSessions(nextSessions);
      setTeamSpotifyLinked(nextTeamSpotifyLinked);
      setSpotifyConfigured(nextSpotifyConfigured);
      setClientIdHint(nextClientIdHint);
      setSpotifyRedirectUri(nextSpotifyRedirectUri);
      setInitialized(true);
    } finally {
      end();
    }
  }, [begin, end, currentUserId]);

  useEffect(() => {
    const spotify = searchParams.get("spotify");
    const spotifyError = searchParams.get("spotify_error");
    const spotifyDetail = searchParams.get("spotify_detail");
    if (spotify || spotifyError) {
      setFlash({ spotify, spotifyError, spotifyDetail });
      window.history.replaceState({}, "", "/sessions");
    }
  }, [searchParams]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    function onTeamChange() {
      void loadAll();
    }
    window.addEventListener("active-team-changed", onTeamChange);
    return () => window.removeEventListener("active-team-changed", onTeamChange);
  }, [loadAll]);

  const canDeleteSessions = currentUserTeamRole != null && isTeamManagerRole(currentUserTeamRole);
  const spotify = flash?.spotify ?? null;
  const spotifyError = flash?.spotifyError ?? null;
  const spotifyDetail = flash?.spotifyDetail ?? null;
  const flashMessage =
    spotify === "linked"
      ? "Team Spotify account linked successfully."
      : spotifyError === "not_configured"
        ? "Spotify is not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to your .env file and restart the dev server."
        : spotifyError === "not_allowlisted"
          ? null
          : spotifyError === "invalid_state"
            ? "Spotify login expired or was interrupted. Try connecting again from team settings."
            : spotifyError
              ? `Spotify error: ${spotifyError}`
              : null;

  async function confirmDeleteSession() {
    if (!pendingDelete) return;

    setDeleting(true);
    setDeleteError(null);

    const res = await fetch(`/api/sessions/${pendingDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      setPendingDelete(null);
      setDeleting(false);
      return;
    }

    const data = await readJsonResponse<{ error?: string }>(res);
    setDeleteError(errorMessageFromBody(data, "Failed to delete session"));
    setDeleting(false);
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError(null);
  }

  if (!initialized) {
    if (loading) return <SessionsPageSkeleton />;
    return null;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Bingo Sessions</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Import Spotify playlists and configure clip ranges for bingo night.
            {activeTeamId
              ? " Showing sessions for the active team."
              : " Select or create a team to view and create sessions."}
          </p>
        </div>
        {activeTeamId && teamSpotifyLinked ? (
          <Link
            href="/sessions/new"
            className="inline-flex w-full shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 sm:w-auto"
          >
            New session
          </Link>
        ) : activeTeamId ? (
          <span
            className="inline-flex w-full shrink-0 cursor-not-allowed items-center justify-center whitespace-nowrap rounded-lg bg-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-500 dark:bg-zinc-800 sm:w-auto"
            title="Connect Spotify for this team in team settings"
          >
            New session
          </span>
        ) : (
          <span
            className="inline-flex w-full shrink-0 cursor-not-allowed items-center justify-center whitespace-nowrap rounded-lg bg-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-500 dark:bg-zinc-800 sm:w-auto"
            title="Create or join a team first"
          >
            New session
          </span>
        )}
      </div>

      {flashMessage && (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            spotifyError
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {flashMessage}
        </div>
      )}

      {spotifyError === "not_allowlisted" && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-medium">Spotify account not approved for this app</p>
          {spotifyDetail && (
            <p className="mt-1 text-amber-800 dark:text-amber-200">
              Spotify says: {spotifyDetail}
            </p>
          )}
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-amber-800 dark:text-amber-200">
            <li>
              Click <strong>Connect Spotify</strong> again and pick the account whose email
              matches the one in Dashboard → Settings → User Management (check your email at{" "}
              <a
                href="https://www.spotify.com/account/profile/"
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                spotify.com/account
              </a>
              ).
            </li>
            <li>
              The app owner must have Spotify Premium. Allowlisted users also need Premium
              in development mode.
            </li>
            <li>
              After adding a user, wait up to 15 minutes for Spotify to apply the change.
            </li>
            <li>
              Confirm your <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">.env</code>{" "}
              Client ID matches the app in the dashboard
              {clientIdHint ? (
                <>
                  {" "}
                  (yours starts with <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">{clientIdHint}</code>)
                </>
              ) : null}
              .
            </li>
            <li>
              If you were logged into a different Spotify account in the browser, log out at{" "}
              <a
                href="https://accounts.spotify.com/logout"
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                accounts.spotify.com/logout
              </a>{" "}
              first, or use a private window.
            </li>
          </ol>
        </div>
      )}

      {!spotifyConfigured && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="font-medium text-red-900 dark:text-red-100">
            Spotify credentials missing
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-red-800 dark:text-red-200">
            <li>
              Create an app at{" "}
              <a
                href="https://developer.spotify.com/dashboard"
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                developer.spotify.com/dashboard
              </a>
            </li>
            <li>
              Add redirect URI:{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900">
                {spotifyRedirectUri ?? "http://127.0.0.1:3000/api/spotify/callback"}
              </code>
            </li>
            <li>
              Set <code className="rounded bg-red-100 px-1 dark:bg-red-900">SPOTIFY_CLIENT_ID</code>{" "}
              and{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900">SPOTIFY_CLIENT_SECRET</code>{" "}
              in your <code className="rounded bg-red-100 px-1 dark:bg-red-900">.env</code> file
            </li>
            <li>Restart the dev server</li>
          </ol>
        </div>
      )}

      {spotifyConfigured && activeTeamId && (
        <SpotifyConnectionCard teamId={activeTeamId} className="mt-6" />
      )}

      {activeTeamId && !teamSpotifyLinked && spotifyConfigured && (
        <p className="mt-2 text-sm text-zinc-500">
          A team admin must connect Spotify in{" "}
          <Link
            href={`/teams/${activeTeamId}/settings`}
            className="text-emerald-600 hover:underline"
          >
            team settings
          </Link>{" "}
          before importing playlists.
        </p>
      )}

      {!activeTeamId && (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">No active team</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Use the Team menu in the header to create a team or join an existing one, then
            select it as active to manage bingo sessions.
          </p>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          {!activeTeamId ? (
            <p className="text-zinc-500">Select a team to see its sessions.</p>
          ) : (
            <>
              <p className="text-zinc-500">No sessions yet.</p>
              {teamSpotifyLinked ? (
                <Link href="/sessions/new" className="mt-2 inline-block text-emerald-600 hover:underline">
                  Create your first bingo session
                </Link>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">
                  Connect team Spotify in{" "}
                  <Link
                    href={`/teams/${activeTeamId}/settings`}
                    className="text-emerald-600 hover:underline"
                  >
                    team settings
                  </Link>{" "}
                  to import a playlist.
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <SessionCard
                session={session}
                teamMembers={teamMembers}
                showMemberPhotos={showMemberPhotos}
                onPlay={(id) => router.push(`/sessions/${id}/play`)}
                onEdit={(id) => router.push(`/sessions/${id}/edit`)}
                onReview={(id) => router.push(`/sessions/${id}/review`)}
                onTeamProgress={(id) => setTeamProgressSessionId(id)}
                onDelete={
                  canDeleteSessions
                    ? (id) => {
                        const target = sessions.find((entry) => entry.id === id);
                        if (!target) return;
                        setDeleteError(null);
                        setPendingDelete({ id: target.id, name: target.name });
                      }
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}

      <DeleteSessionDialog
        sessionName={pendingDelete?.name ?? ""}
        open={pendingDelete !== null}
        deleting={deleting}
        error={deleteError}
        onCancel={closeDeleteDialog}
        onConfirm={() => void confirmDeleteSession()}
      />

      <SessionTeamProgressDialog
        sessionId={teamProgressSessionId}
        open={teamProgressSessionId !== null}
        currentUserId={currentUserId}
        onClose={() => setTeamProgressSessionId(null)}
      />
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense>
      <SessionsContent />
    </Suspense>
  );
}
