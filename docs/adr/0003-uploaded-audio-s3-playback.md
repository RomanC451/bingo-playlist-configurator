# ADR 0003: Uploaded audio in S3 for edit, review, and guess

## Status

Accepted

## Context

Teams may have audio files they already have rights to (purchased downloads, licensed copies, etc.) and want reliable clip preview without depending on Spotify connectivity, Premium, or OAuth scopes.

Edit, review, and guess pages already abstract playback behind hooks and clip boundary logic. Waveforms are placeholder-based and can use uploaded duration metadata.

## Decision

Allow **UploadedAudio** on **AWS S3** for edit, review, and guess preview (upload-only; no in-browser Spotify on those pages):

- **Upload flow:** **SessionAudioUpload** on the session edit page — bulk MP3 select, review dialog, presigned PUT batch → confirm via API → metadata on `TrackClip`
- **Playback:** shared `HTMLAudioElement` via `useHtmlAudioPlayer` through `useClipPlayback` when `hasUploadedAudio`
- **Streaming:** proxy S3 through Next.js API routes with HTTP Range support (private bucket)
- **Guess public access:** `/api/public/guess/[shareToken]/audio/[clipId]` gated by share token + guest header
- **Play page:** **ConnectPlayback** only (unchanged)

## Consequences

- Requires AWS env vars: `S3_AUDIO_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; optional `S3_AUDIO_PREFIX`
- Requires S3 bucket CORS for browser PUT from the app origin
- User runs `npm run db:push` for new `TrackClip` upload fields
- Uploaded files are not used for waveforms beyond duration metadata in v1 (peak extraction deferred)
- Legal/compliance: operators must only upload audio they have rights to

## Alternatives considered

- **Supabase Storage** — rejected; project uses AWS S3
- **Presigned GET URLs to clients** — rejected; proxy keeps bucket private and guess access token-gated
- **Replace Spotify entirely on edit/review/guess** — rejected; prefer-upload fallback preserves existing flow
