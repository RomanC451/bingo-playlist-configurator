# ADR 0002: Web Playback SDK on edit and review

## Status

Accepted

## Context

Edit and review pages need reliable in-browser clip preview. The existing Spotify Connect flow requires a desktop or mobile Spotify app, issues many Web API calls per preview, and contributes to rate limiting.

## Decision

Use the **Spotify Web Playback SDK** on **track edit** and **review** pages only:

- One client `PUT /me/player/play` to start or switch tracks at `position_ms`
- SDK `seek`, `pause`, `resume`, and `player_state_changed` for progress and clip boundaries
- Team access token via `/api/spotify/player-token` (requires `streaming` scope and Premium)
- Banner + block preview until the team re-links with `streaming`

Keep **Connect playback** unchanged on the **play session** page for routing audio to external speakers.

No Connect fallback on edit/review when SDK is unavailable — show re-link or Premium errors instead.

## Consequences

- Teams must re-link Spotify once after `streaming` is added to OAuth scopes
- Only one active stream per **SpotifyConnection** (shared team account); concurrent previews can interrupt each other
- Play page still requires an external Connect device
- Fewer Web API calls during edit/review preview (no device polling or playback verification loop)

## Alternatives considered

- **Connect everywhere** — rejected; poor UX on edit/review and heavy API usage
- **SDK on play page too** — deferred; hosts may prefer phone/speaker routing
- **Connect fallback on edit/review** — rejected; does not solve the core UX goal and preserves rate-limit pressure
