export type AvatarOption = {
  id: string;
  label: string;
  url: string;
};

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: "aurora",
    label: "Aurora",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=aurora&backgroundColor=b6e3f4",
  },
  {
    id: "blaze",
    label: "Blaze",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=blaze&backgroundColor=c0aede",
  },
  {
    id: "coral",
    label: "Coral",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=coral&backgroundColor=ffd5dc",
  },
  {
    id: "fern",
    label: "Fern",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=fern&backgroundColor=d1f4d1",
  },
  {
    id: "hazel",
    label: "Hazel",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=hazel&backgroundColor=ffdfbf",
  },
  {
    id: "indigo",
    label: "Indigo",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=indigo&backgroundColor=c7d2fe",
  },
  {
    id: "jade",
    label: "Jade",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=jade&backgroundColor=a7f3d0",
  },
  {
    id: "kit",
    label: "Kit",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=kit&backgroundColor=fde68a",
  },
  {
    id: "luna",
    label: "Luna",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=luna&backgroundColor=e9d5ff",
  },
  {
    id: "moss",
    label: "Moss",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=moss&backgroundColor=bbf7d0",
  },
  {
    id: "nova",
    label: "Nova",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=nova&backgroundColor=fecaca",
  },
  {
    id: "reed",
    label: "Reed",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=reed&backgroundColor=d6d3d1",
  },
];

const ALLOWED_AVATAR_URLS = new Set(AVATAR_OPTIONS.map((option) => option.url));

export function isAllowedAvatarUrl(url: string): boolean {
  return ALLOWED_AVATAR_URLS.has(url);
}

export function findAvatarOption(url: string | null | undefined): AvatarOption | null {
  if (!url) return null;
  return AVATAR_OPTIONS.find((option) => option.url === url) ?? null;
}
