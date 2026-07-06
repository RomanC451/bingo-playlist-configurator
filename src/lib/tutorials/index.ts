import { audioUploadTutorial } from "@/lib/tutorials/audio-upload";
import { clipGuessGuestTutorial } from "@/lib/tutorials/clip-guess-guest";
import { clipGuessSetupTutorial } from "@/lib/tutorials/clip-guess-setup";
import { clipReactionsTutorial } from "@/lib/tutorials/clip-reactions";
import { createSessionTutorial } from "@/lib/tutorials/create-session";
import { dashboardTutorial } from "@/lib/tutorials/dashboard";
import { editLocksTutorial } from "@/lib/tutorials/edit-locks";
import { guessAnalyticsTutorial } from "@/lib/tutorials/guess-analytics";
import { needsAttentionTutorial } from "@/lib/tutorials/needs-attention";
import { playSessionTutorial } from "@/lib/tutorials/play-session";
import { profileTutorial } from "@/lib/tutorials/profile";
import { reviewClipsTutorial } from "@/lib/tutorials/review-clips";
import { sessionAdminTutorial } from "@/lib/tutorials/session-admin";
import { sessionEditTutorial } from "@/lib/tutorials/session-edit";
import { sessionsListTutorial } from "@/lib/tutorials/sessions-list";
import { spotifyConnectTutorial } from "@/lib/tutorials/spotify-connect";
import { spotifyDeviceTutorial } from "@/lib/tutorials/spotify-device";
import { teamReviewsTutorial } from "@/lib/tutorials/team-reviews";
import { teamSettingsTutorial } from "@/lib/tutorials/team-settings";
import { teamsTutorial } from "@/lib/tutorials/teams";
import { trackEditorTutorial } from "@/lib/tutorials/track-editor";
import { uploadedAudioRequiredTutorial } from "@/lib/tutorials/uploaded-audio-required";
import type { TutorialDefinition } from "@/lib/tutorial";

export const tutorials = {
  dashboard: dashboardTutorial,
  teams: teamsTutorial,
  "spotify-connect": spotifyConnectTutorial,
  "sessions-list": sessionsListTutorial,
  "create-session": createSessionTutorial,
  "session-edit": sessionEditTutorial,
  "track-editor": trackEditorTutorial,
  "audio-upload": audioUploadTutorial,
  "review-clips": reviewClipsTutorial,
  "play-session": playSessionTutorial,
  "team-reviews": teamReviewsTutorial,
  "clip-guess-setup": clipGuessSetupTutorial,
  "clip-guess-guest": clipGuessGuestTutorial,
  "guess-analytics": guessAnalyticsTutorial,
  "team-settings": teamSettingsTutorial,
  profile: profileTutorial,
  "session-admin": sessionAdminTutorial,
  "needs-attention": needsAttentionTutorial,
  "clip-reactions": clipReactionsTutorial,
  "edit-locks": editLocksTutorial,
  "uploaded-audio-required": uploadedAudioRequiredTutorial,
  "spotify-device": spotifyDeviceTutorial,
} as const satisfies Record<string, TutorialDefinition>;

export type TutorialId = keyof typeof tutorials;

export const tutorialJourney: TutorialId[] = [
  "dashboard",
  "teams",
  "spotify-connect",
  "sessions-list",
  "create-session",
  "session-edit",
  "track-editor",
  "audio-upload",
  "review-clips",
  "play-session",
];

export const contextualTutorialIds = [
  "needs-attention",
  "clip-reactions",
  "edit-locks",
  "uploaded-audio-required",
  "spotify-device",
] as const satisfies readonly TutorialId[];

export type ContextualTutorialId = (typeof contextualTutorialIds)[number];

export function getTutorial(id: TutorialId): TutorialDefinition {
  return tutorials[id];
}

export function listTutorials(): TutorialDefinition[] {
  return Object.values(tutorials);
}

export function isContextualTutorial(id: TutorialId): id is ContextualTutorialId {
  return (contextualTutorialIds as readonly TutorialId[]).includes(id);
}
