export interface GiveawayComment {
  id: string;
  username: string;
  displayName: string | null;
  text: string;
  createdAt: string | null;
  isReply: boolean;
  thumbnailUrl: string | null;
}

export interface GiveawayEntry extends GiveawayComment {}

export interface GiveawayFilters {
  uniqueUsers: boolean;
  requireTag: boolean;
}
