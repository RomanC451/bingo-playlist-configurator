export type TeamRoleValue = "ADMIN" | "MEMBER";

export function formatTeamRoleLabel(role: TeamRoleValue): string {
  return role === "ADMIN" ? "Owner" : "Member";
}

export function notifyActiveTeamChanged(teamId: string | null) {
  window.dispatchEvent(
    new CustomEvent("active-team-changed", { detail: { teamId } }),
  );
}

export async function persistActiveTeam(teamId: string): Promise<boolean> {
  const res = await fetch("/api/teams/active", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId }),
  });

  if (!res.ok) {
    return false;
  }

  notifyActiveTeamChanged(teamId);
  return true;
}

export function clearActiveTeam() {
  notifyActiveTeamChanged(null);
  void fetch("/api/teams/active", { method: "DELETE" });
}
