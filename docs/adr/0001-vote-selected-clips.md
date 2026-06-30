# ADR 0001: Vote-selected clip playback

## Status

Accepted

## Context

Multiple team members may propose different clip ranges for the same song. At playback time we need a single authoritative range.

## Decision

Playback uses the **WinningProposal** — the proposal with the most team votes. Ties break to the earliest proposal (`createdAt`). When no votes exist, playback uses the **DefaultClip** on the track (import range).

## Consequences

- Clip ranges on `TrackClip` are defaults only; they do not override team votes.
- Members must vote for a proposal to affect playback; proposing alone is not enough.
- Tie-breaking favors early consensus, reducing ambiguity without a host override.

## Alternatives considered

- **Host pick** — rejected; opaque to other members and hard to reverse.
- **Latest edit wins** — rejected; discourages collaboration and voting.
