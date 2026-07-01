"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Crown, MoreVertical, Shield, ShieldOff, Trash2 } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DeleteTeamDialog } from "@/components/DeleteTeamDialog";
import { SpotifyConnectionCard } from "@/components/SpotifyConnectionCard";
import { TeamSettingsPageSkeleton } from "@/components/page-skeletons";
import { Button } from "@/components/ui/button";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { errorMessageFromBody } from "@/lib/api-errors";
import { readJsonResponse } from "@/lib/read-json-response";
import {
  notifyActiveTeamChanged,
  formatTeamRoleLabel,
  isTeamManagerRole,
  type TeamRoleValue,
} from "@/lib/team-client";

interface TeamMember {
  id: string;
  role: TeamRoleValue;
  user: { id: string; name: string | null; email: string };
}

interface TeamDetail {
  id: string;
  name: string;
  members: TeamMember[];
  _count: { bingoSessions: number };
}

function MemberActionsMenu({
  member,
  canTransfer,
  canDemote,
  onPromote,
  onDemote,
  onTransfer,
  onRemove,
}: {
  member: TeamMember;
  canTransfer: boolean;
  canDemote: boolean;
  onPromote: () => void | Promise<void>;
  onDemote: () => void | Promise<void>;
  onTransfer: () => void | Promise<void>;
  onRemove: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const memberName = member.user.name ?? member.user.email;

  function runAction(action: () => void | Promise<void>) {
    setOpen(false);
    void Promise.resolve(action());
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={`Actions for ${memberName}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical className="size-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg">
          {member.role === "MEMBER" && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runAction(onPromote)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <Shield className="size-4" />
              Make admin
            </button>
          )}
          {canDemote && member.role === "ADMIN" && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runAction(onDemote)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <ShieldOff className="size-4" />
              Make member
            </button>
          )}
          {canTransfer && member.role !== "OWNER" && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runAction(onTransfer)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <Crown className="size-4" />
              Transfer ownership
            </button>
          )}
          {member.role !== "OWNER" && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runAction(onRemove)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="size-4" />
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function TeamSettingsPage() {
  return (
    <Suspense>
      <TeamSettingsContent />
    </Suspense>
  );
}

function TeamSettingsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: authSession } = useSession();
  const teamId = params.id as string;
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { loading, begin, end } = useDelayedLoading();
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [spotifyFlash, setSpotifyFlash] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);

  function runMenuAction(action: () => void | Promise<void>) {
    void Promise.resolve(action()).catch(() => {
      setMemberActionError("Something went wrong. Try again.");
    });
  }

  useEffect(() => {
    const spotify = searchParams.get("spotify");
    const spotifyError = searchParams.get("spotify_error");
    const spotifyDetail = searchParams.get("spotify_detail");

    if (spotify === "linked") {
      setSpotifyFlash({
        success: true,
        message: "Team Spotify account linked successfully.",
      });
      window.history.replaceState({}, "", `/teams/${teamId}/settings`);
    } else if (spotifyError) {
      const message =
        spotifyError === "loopback_required"
          ? "Spotify cannot use VPN/LAN addresses for login. Open http://127.0.0.1:3000 while signed in, go to team settings, and connect Spotify there."
          : spotifyError === "forbidden"
            ? "Only team admins can connect Spotify for this team."
          : spotifyError === "account_switch_incomplete"
            ? "Could not switch Spotify accounts. Log out at accounts.spotify.com, then try again."
            : spotifyError === "invalid_state"
              ? "Spotify login expired or was interrupted. Try again."
              : spotifyDetail
                ? `${spotifyError}: ${spotifyDetail}`
                : `Spotify error: ${spotifyError}`;
      setSpotifyFlash({ success: false, message });
      window.history.replaceState({}, "", `/teams/${teamId}/settings`);
    }
  }, [searchParams, teamId]);

  const loadTeam = useCallback(async () => {
    begin();
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load team");
        setTeam(null);
      } else {
        setTeam(data);
        setError(null);
      }
      setInitialized(true);
    } finally {
      end();
    }
  }, [begin, end, teamId]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  async function copyTeamId() {
    try {
      await navigator.clipboard.writeText(teamId);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 2000);
    } catch {
      setCopiedId(false);
    }
  }

  async function removeMember(userId: string, memberEmail: string) {
    if (!confirm(`Remove ${memberEmail} from this team?`)) return;
    setMemberActionError(null);
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      await loadTeam();
      return;
    }
    const data = await readJsonResponse<{ error?: string }>(res);
    setMemberActionError(errorMessageFromBody(data, "Failed to remove member"));
  }

  async function promoteMember(userId: string, memberName: string) {
    if (!confirm(`Make ${memberName} a team admin? They can manage members and Spotify.`)) {
      return;
    }
    setMemberActionError(null);
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: "ADMIN" }),
    });
    if (res.ok) {
      await loadTeam();
      return;
    }
    const data = await readJsonResponse<{ error?: string }>(res);
    setMemberActionError(errorMessageFromBody(data, "Failed to update member role"));
  }

  async function demoteMember(userId: string) {
    setMemberActionError(null);
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: "MEMBER" }),
    });
    if (res.ok) {
      await loadTeam();
      return;
    }
    const data = await readJsonResponse<{ error?: string }>(res);
    setMemberActionError(errorMessageFromBody(data, "Failed to update member role"));
  }

  async function transferOwnership(userId: string, memberName: string) {
    if (
      !confirm(
        `Transfer team ownership to ${memberName}? You will become an admin and they will be the owner.`,
      )
    ) {
      return;
    }
    setMemberActionError(null);
    const res = await fetch(`/api/teams/${teamId}/ownership`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      await loadTeam();
      return;
    }
    const data = await readJsonResponse<{ error?: string }>(res);
    setMemberActionError(errorMessageFromBody(data, "Failed to transfer ownership"));
  }

  async function handleLeaveTeam() {
    if (
      !team ||
      !confirm(`Leave ${team.name}? You will lose access to this team's bingo sessions.`)
    ) {
      return;
    }

    setLeaving(true);
    setLeaveError(null);

    const res = await fetch(`/api/teams/${teamId}/leave`, { method: "POST" });
    const data = await readJsonResponse<{ error?: string }>(res);

    if (!res.ok) {
      setLeaveError(errorMessageFromBody(data, "Failed to leave team"));
      setLeaving(false);
      return;
    }

    notifyActiveTeamChanged(null);
    router.push("/teams");
  }

  async function handleDeleteTeam() {
    setDeleting(true);
    setDeleteError(null);

    const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    const data = await readJsonResponse<{ error?: string }>(res);

    if (!res.ok) {
      setDeleteError(errorMessageFromBody(data, "Failed to delete team"));
      setDeleting(false);
      return;
    }

    notifyActiveTeamChanged(null);
    router.push("/teams");
  }

  const currentUserId = authSession?.user?.id;
  const myMembership = team?.members.find((m) => m.user.id === currentUserId);
  const isManager = myMembership ? isTeamManagerRole(myMembership.role) : false;
  const isOwner = myMembership?.role === "OWNER";

  if (!initialized) {
    if (loading) return <TeamSettingsPageSkeleton />;
    return null;
  }

  return (
    <div>
      <Breadcrumb
        className="mb-4"
        items={[
          { label: "Teams", href: "/teams" },
          { label: team?.name ?? "Team" },
        ]}
      />

      {error || !team ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error ?? "Team not found"}
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">{team.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">Team members and access</p>

          {spotifyFlash && (
            <div
              className={`mt-4 rounded-lg border p-3 text-sm ${
                spotifyFlash.success
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {spotifyFlash.message}
            </div>
          )}

          <section className="mt-6">
            <h2 className="text-lg font-medium">Spotify</h2>
            <p className="mt-1 text-sm text-zinc-500">
              One shared Spotify account for importing playlists and playback during bingo
              night.{" "}
              {isManager
                ? "As a team admin, you can connect or change it."
                : "Only team admins can connect Spotify."}
            </p>
            <SpotifyConnectionCard teamId={teamId} className="mt-3" />
          </section>

          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="font-medium">Team ID for joining</p>
            <p className="mt-1 text-xs text-zinc-500">
              Share this with members so they can use <strong>Join</strong> on the Teams page.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-white px-2 py-1 font-mono text-xs dark:bg-zinc-950">
                {teamId}
              </code>
              <button
                type="button"
                onClick={() => void copyTeamId()}
                className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-950"
              >
                {copiedId ? "Copied!" : "Copy ID"}
              </button>
            </div>
          </div>

          {memberActionError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {memberActionError}
            </div>
          )}

          <ul className="mt-8 space-y-2">
            {team.members.map((member) => {
              const showMemberMenu =
                isManager &&
                member.user.id !== currentUserId &&
                (isOwner || member.role !== "OWNER");

              return (
              <li
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div>
                  <p className="font-medium">{member.user.name ?? member.user.email}</p>
                  <p className="text-sm text-zinc-500">{member.user.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="w-14 text-right text-xs text-zinc-400">
                    {formatTeamRoleLabel(member.role)}
                  </span>
                  <div className="flex size-8 items-center justify-center">
                    {showMemberMenu && (
                      <MemberActionsMenu
                        member={member}
                        canTransfer={isOwner}
                        canDemote={isOwner}
                        onPromote={() =>
                          runMenuAction(() =>
                            promoteMember(
                              member.user.id,
                              member.user.name ?? member.user.email,
                            ),
                          )
                        }
                        onDemote={() =>
                          runMenuAction(() => demoteMember(member.user.id))
                        }
                        onTransfer={() =>
                          runMenuAction(() =>
                            transferOwnership(
                              member.user.id,
                              member.user.name ?? member.user.email,
                            ),
                          )
                        }
                        onRemove={() =>
                          runMenuAction(() => removeMember(member.user.id, member.user.email))
                        }
                      />
                    )}
                  </div>
                </div>
              </li>
              );
            })}
          </ul>

          {myMembership && !isOwner && (
            <section className="mt-12 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-medium">Leave team</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Remove yourself from {team.name}. You can rejoin later with the team ID.
              </p>
              {leaveError && (
                <p className="mt-2 text-sm text-red-600">{leaveError}</p>
              )}
              <button
                type="button"
                disabled={leaving}
                onClick={() => void handleLeaveTeam()}
                className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {leaving ? "Leaving…" : "Leave team"}
              </button>
            </section>
          )}

          {isOwner && (
            <section className="mt-12 rounded-xl border border-red-200 p-4 dark:border-red-900/50">
              <h2 className="text-lg font-medium text-red-700 dark:text-red-400">Danger zone</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Permanently delete this team
                {team._count.bingoSessions > 0
                  ? ` and its ${team._count.bingoSessions} bingo session${team._count.bingoSessions === 1 ? "" : "s"}`
                  : ""}
                . All members will lose access. Transfer ownership first if you want the team to continue without you.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
                className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
              >
                Delete team
              </button>
            </section>
          )}
        </>
      )}

      <DeleteTeamDialog
        teamName={team?.name ?? ""}
        open={deleteOpen}
        deleting={deleting}
        error={deleteError}
        onCancel={() => {
          if (deleting) return;
          setDeleteOpen(false);
          setDeleteError(null);
        }}
        onConfirm={() => void handleDeleteTeam()}
      />
    </div>
  );
}
