"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DeleteTeamDialog } from "@/components/DeleteTeamDialog";
import { TeamSettingsPageSkeleton } from "@/components/page-skeletons";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { errorMessageFromBody } from "@/lib/api-errors";
import { readJsonResponse } from "@/lib/read-json-response";
import { notifyActiveTeamChanged, formatTeamRoleLabel } from "@/lib/team-client";

interface TeamMember {
  id: string;
  role: "ADMIN" | "MEMBER";
  user: { id: string; name: string | null; email: string };
}

interface TeamDetail {
  id: string;
  name: string;
  members: TeamMember[];
  _count: { bingoSessions: number };
}

export default function TeamSettingsPage() {
  const params = useParams();
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
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) await loadTeam();
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
  const isAdmin = myMembership?.role === "ADMIN";
  const adminCount = team?.members.filter((m) => m.role === "ADMIN").length ?? 0;
  const isOnlyAdmin = isAdmin && adminCount <= 1;

  if (!initialized) {
    if (loading) return <TeamSettingsPageSkeleton />;
    return null;
  }

  return (
    <div>
      <Breadcrumb
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

          <ul className="mt-8 space-y-2">
            {team.members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div>
                  <p className="font-medium">{member.user.name ?? member.user.email}</p>
                  <p className="text-sm text-zinc-500">{member.user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400">{formatTeamRoleLabel(member.role)}</span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => void removeMember(member.user.id, member.user.email)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {myMembership && !isOnlyAdmin && (
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

          {isOnlyAdmin && (
            <section className="mt-12 rounded-xl border border-red-200 p-4 dark:border-red-900/50">
              <h2 className="text-lg font-medium text-red-700 dark:text-red-400">Danger zone</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Permanently delete this team
                {team._count.bingoSessions > 0
                  ? ` and its ${team._count.bingoSessions} bingo session${team._count.bingoSessions === 1 ? "" : "s"}`
                  : ""}
                . All members will lose access.
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
