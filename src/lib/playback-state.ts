export type ClipPlaybackState = {
  is_playing: boolean;
  progress_ms: number | null;
  item: { id: string } | null;
};
