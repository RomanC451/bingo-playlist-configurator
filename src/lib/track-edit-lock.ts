export type TrackEditingBy = {
  userId: string;
  name: string;
  image: string | null;
};

export function isTrackLockedByOther(
  editingBy: TrackEditingBy | null | undefined,
  currentUserId: string | null | undefined,
): boolean {
  if (!editingBy || !currentUserId) {
    return Boolean(editingBy);
  }
  return editingBy.userId !== currentUserId;
}
