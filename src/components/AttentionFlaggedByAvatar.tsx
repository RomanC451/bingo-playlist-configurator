"use client";

import { useAlternatingMemberPhotos } from "@/components/MemberAvatarStack";
import type { AttentionFlaggedBy } from "@/lib/track-attention";
import { cn } from "@/lib/utils";

const ATTENTION_AVATAR_COLORS = [
  "bg-emerald-600 text-white",
  "bg-sky-600 text-white",
  "bg-violet-600 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
] as const;

function attentionAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash + userId.charCodeAt(i)) % ATTENTION_AVATAR_COLORS.length;
  }
  return ATTENTION_AVATAR_COLORS[hash]!;
}

const sizeClasses = {
  sm: "size-5 text-[10px]",
  md: "size-6 text-[11px]",
} as const;

export function AttentionFlaggedByAvatar({
  user,
  size = "sm",
  className,
}: {
  user: AttentionFlaggedBy;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  const showPhoto = useAlternatingMemberPhotos();
  const initial = user.name.charAt(0).toUpperCase();
  const hasImage = Boolean(user.image);

  if (!hasImage) {
    return (
      <span
        title={user.name}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-background font-semibold",
          sizeClasses[size],
          attentionAvatarColor(user.userId),
          className,
        )}
      >
        {initial}
      </span>
    );
  }

  return (
    <span
      title={user.name}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-background",
        sizeClasses[size],
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={user.image!}
        alt=""
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-500",
          showPhoto ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        className={cn(
          "flex size-full items-center justify-center font-semibold transition-opacity duration-500",
          attentionAvatarColor(user.userId),
          showPhoto ? "opacity-0" : "opacity-100",
        )}
      >
        {initial}
      </span>
    </span>
  );
}
