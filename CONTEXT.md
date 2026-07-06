# Bingo Playlist Configurator — Domain Context

This document defines the vocabulary used across the codebase. Prefer these terms in code, UI copy, and discussions.

## Core entities

### Team
A group that owns bingo sessions. Users can belong to multiple teams.

### TeamMember
A user's membership on a Team. Role is `ADMIN` or `MEMBER`.

- **ADMIN** — manage members, delete sessions
- **MEMBER** — propose clips, vote, import playlists, playback

### SpotifyConnection
OAuth tokens for one Spotify account linked to a Team. Team admins connect, switch, or disconnect. All members use the team account for playlist import and **ConnectPlayback** on bingo night.

### ConnectPlayback
Playback on the play session page via Spotify Connect — audio plays on an external desktop, mobile, or speaker device selected by the user.

### BingoSession
A Spotify playlist import plus its track list. Belongs to one Team. Created by a User (`userId`).

### Track (`TrackClip`)
A song in a session (metadata + position). The `startMs` / `endMs` on the track are the **DefaultClip** only — not the canonical playback range when votes exist.

### ClipProposal
One team member's suggested `startMs` / `endMs` for a Track. At most one proposal per member per track.

### ClipVote
A member's single vote for one proposal on a track. Enforced unique per `(trackClipId, userId)`.

### WinningProposal
Computed at playback time: the proposal with the most votes; ties break to the earliest `createdAt`. Used for playback when any votes exist.

### DefaultClip
Fallback range on a Track when no votes exist: `startMs` (typically `0`) through `endMs` (typically `defaultClipDurationMs` capped by track duration). Set on playlist import.

### TrackClipReview
A per-user OK / Not OK verdict on a track's current playback clip. One row per `(trackClipId, userId)`. Bound to the `versionId` reviewed (`null` = **DefaultClip**). A review is **stale** when playback resolves to a different `versionId` — the track re-enters that user's review queue.

- **OK** — clip is acceptable; clears `needsAttention` only if this user flagged it
- **Not OK** — clip needs work; sets `needsAttention` with optional comment

### ClipGuess
An anonymous visitor's single locked guess for which **Track** (`TrackClip`) a heard clip belongs to. One row per `(sessionId, guestId, trackClipId)`. Correct when `guessedTrackClipId === trackClipId`.

### ClipGuessGuest
Opaque ID stored in the visitor's browser (`localStorage`), not a **User**. Used to resume ClipGuess progress across visits.

### Guess share link
A token-gated public URL (`/guess/[shareToken]`) scoped to one **BingoSession**. Team admins enable, disable, or rotate the token. Playback requires **UploadedAudio** on the heard clip.

### UploadedAudio
An audio file stored in AWS S3 for a **Track** (`TrackClip`). Required for edit, review, and guess preview. Upload only files you have rights to use.

### SessionAudioUpload
Bulk MP3 upload flow on the **BingoSession** edit page: select files → review dialog → assign every **Track** → submit to S3. Replaces per-track upload UI.

### AudioFileAssignment
Mapping of a local MP3 file to a **Track** during **SessionAudioUpload**, either from fuzzy filename matching or manual selection in the review dialog.

## Access rules

- Session access requires membership on the session's Team.
- **ClipGuess** is public via an enabled guess share link; no account required.
- Spotify credentials are per-team (`SpotifyConnection` on Team). Team admins link one shared account; any member can import playlists and control **ConnectPlayback** on that account's devices.
- Edit, review, and guess preview require **UploadedAudio** on each **Track**. The play session page uses **ConnectPlayback** on external devices.
- **ClipGuess** public audio streams require a valid share token and guest id; uploaded audio is proxied through the app (S3 bucket stays private).
- Only one active Spotify stream per team account at a time (bingo night **ConnectPlayback**).
- Team join is admin-only: add member by email (no accept flow).

## Bootstrap

After schema changes, run:

```bash
npm run db:push
npm run db:bootstrap-teams
```

This creates a personal team for each existing user and assigns orphan sessions.
