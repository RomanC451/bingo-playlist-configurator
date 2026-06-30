# Bingo Playlist Configurator — Domain Context

This document defines the vocabulary used across the codebase. Prefer these terms in code, UI copy, and discussions.

## Core entities

### Team
A group that owns bingo sessions. Users can belong to multiple teams.

### TeamMember
A user's membership on a Team. Role is `ADMIN` or `MEMBER`.

- **ADMIN** — manage members, delete sessions
- **MEMBER** — propose clips, vote, import (if Spotify linked), playback

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

## Access rules

- Session access requires membership on the session's Team.
- Spotify credentials remain **per-user** (`SpotifyConnection`); any linked member can import and control playback on their device.
- Team join is admin-only: add member by email (no accept flow).

## Bootstrap

After schema changes, run:

```bash
npm run db:push
npm run db:bootstrap-teams
```

This creates a personal team for each existing user and assigns orphan sessions.
