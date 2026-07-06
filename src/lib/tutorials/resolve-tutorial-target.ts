import { readJsonResponse } from "@/lib/read-json-response";
import { getTutorial, type TutorialId } from "@/lib/tutorials";

export const TUTORIAL_TOUR_QUERY_PARAM = "tour";

type TutorialRequirement =
  | "static"
  | "team"
  | "session"
  | "sessionWithTracks"
  | "sessionWithGuessShare";

const tutorialRequirements: Record<TutorialId, TutorialRequirement> = {
  dashboard: "static",
  teams: "static",
  profile: "static",
  "sessions-list": "team",
  "spotify-connect": "team",
  "create-session": "team",
  "team-settings": "team",
  "session-edit": "session",
  "audio-upload": "session",
  "review-clips": "session",
  "play-session": "session",
  "team-reviews": "session",
  "clip-guess-setup": "session",
  "session-admin": "session",
  "guess-analytics": "session",
  "uploaded-audio-required": "session",
  "spotify-device": "session",
  "track-editor": "sessionWithTracks",
  "needs-attention": "sessionWithTracks",
  "clip-reactions": "sessionWithTracks",
  "edit-locks": "sessionWithTracks",
  "clip-guess-guest": "sessionWithGuessShare",
};

interface TeamSummary {
  id: string;
  name: string;
}

interface SessionListItem {
  id: string;
  userReviewProgress?: { total: number };
}

interface SessionDetail {
  tracks: { id: string; position: number }[];
}

export type ResolveTutorialTargetResult =
  | { ok: true; href: string; teamId?: string }
  | { ok: false; message: string; description?: string };

function buildHref(
  routeTemplate: string,
  params: { teamId?: string; sessionId?: string; clipId?: string; shareToken?: string },
): string {
  if (routeTemplate === "/teams/[id]/settings" && params.teamId) {
    return `/teams/${params.teamId}/settings`;
  }
  if (routeTemplate.includes("[shareToken]") && params.shareToken) {
    return `/guess/${params.shareToken}`;
  }

  let href = routeTemplate;
  if (params.sessionId) href = href.replace("[id]", params.sessionId);
  if (params.clipId) href = href.replace("[clipId]", params.clipId);
  return href;
}

async function fetchTeams(): Promise<{ teams: TeamSummary[]; activeTeamId: string | null } | null> {
  const res = await fetch("/api/teams");
  if (!res.ok) return null;
  return readJsonResponse<{ teams: TeamSummary[]; activeTeamId: string | null }>(res);
}

async function fetchSessions(teamId: string): Promise<SessionListItem[]> {
  const res = await fetch(`/api/sessions?teamId=${encodeURIComponent(teamId)}`);
  if (!res.ok) return [];
  return readJsonResponse<SessionListItem[]>(res);
}

async function fetchFirstTrackId(sessionId: string): Promise<string | null> {
  const res = await fetch(`/api/sessions/${sessionId}`);
  if (!res.ok) return null;
  const data = await readJsonResponse<SessionDetail>(res);
  const tracks = [...(data.tracks ?? [])].sort((a, b) => a.position - b.position);
  return tracks[0]?.id ?? null;
}

async function fetchGuessShareToken(sessionId: string): Promise<string | null> {
  const res = await fetch(`/api/sessions/${sessionId}/guess-share`);
  if (!res.ok) return null;
  const data = await readJsonResponse<{
    guessShareEnabled?: boolean;
    guessShareToken?: string | null;
  }>(res);
  if (!data.guessShareEnabled || !data.guessShareToken) return null;
  return data.guessShareToken;
}

function trackCount(session: SessionListItem): number {
  return session.userReviewProgress?.total ?? 0;
}

export function pathnameMatchesTutorialHref(pathname: string, href: string): boolean {
  return pathname.split("?")[0] === href.split("?")[0];
}

export async function resolveTutorialTarget(
  tutorialId: TutorialId,
): Promise<ResolveTutorialTargetResult> {
  const tutorial = getTutorial(tutorialId);
  const requirement = tutorialRequirements[tutorialId];

  if (requirement === "static") {
    return { ok: true, href: tutorial.route };
  }

  const teamsData = await fetchTeams();
  if (!teamsData || teamsData.teams.length === 0) {
    return {
      ok: false,
      message: "Create or join a team first",
      description: "This tour needs a team. Go to Teams to get started.",
    };
  }

  const team = teamsData.teams[0];

  if (requirement === "team") {
    return {
      ok: true,
      href: buildHref(tutorial.route, { teamId: team.id }),
      teamId: team.id,
    };
  }

  const sessions = await fetchSessions(team.id);
  if (sessions.length === 0) {
    return {
      ok: false,
      message: "Create a bingo session first",
      description: "Import a Spotify playlist into a new session, then try this tour again.",
    };
  }

  const session =
    requirement === "sessionWithTracks"
      ? sessions.find((entry) => trackCount(entry) > 0)
      : sessions[0];

  if (!session) {
    return {
      ok: false,
      message: "Add tracks to a session first",
      description:
        "Import a Spotify playlist into a session so there is at least one track to edit.",
    };
  }

  if (requirement === "sessionWithGuessShare") {
    const shareToken = await fetchGuessShareToken(session.id);
    if (!shareToken) {
      return {
        ok: false,
        message: "Enable ClipGuess sharing first",
        description:
          "Open a session, use Session actions → ClipGuess, and turn on the guest link.",
      };
    }
    return {
      ok: true,
      href: buildHref(tutorial.route, { shareToken }),
      teamId: team.id,
    };
  }

  if (requirement === "sessionWithTracks") {
    const clipId = await fetchFirstTrackId(session.id);
    if (!clipId) {
      return {
        ok: false,
        message: "Add tracks to a session first",
        description:
          "Import a Spotify playlist into a session so there is at least one track to edit.",
      };
    }
    return {
      ok: true,
      href: buildHref(tutorial.route, { sessionId: session.id, clipId }),
      teamId: team.id,
    };
  }

  return {
    ok: true,
    href: buildHref(tutorial.route, { sessionId: session.id }),
    teamId: team.id,
  };
}
