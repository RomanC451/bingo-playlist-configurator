"use client";

import { useEffect, useState } from "react";

export type MemberUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

const MEMBER_AVATAR_COLORS = [
  "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  "bg-sky-500/20 text-sky-700 dark:text-sky-300",
  "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  "bg-rose-500/20 text-rose-700 dark:text-rose-300",
] as const;

function memberLabel(user: MemberUser): string {
  return user.name?.trim() || user.email.split("@")[0] || "?";
}

function memberInitial(user: MemberUser): string {
  return memberLabel(user).charAt(0).toUpperCase();
}

function memberColorClass(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash + userId.charCodeAt(i)) % MEMBER_AVATAR_COLORS.length;
  }
  return MEMBER_AVATAR_COLORS[hash]!;
}

function MemberAvatar({
  user,
  showPhoto,
}: {
  user: MemberUser;
  showPhoto: boolean;
}) {
  const initial = memberInitial(user);
  const hasImage = Boolean(user.image);

  if (!hasImage) {
    return (
      <div
        className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-card text-[11px] font-semibold ${memberColorClass(user.id)}`}
        title={user.name ?? user.email}
      >
        {initial}
      </div>
    );
  }

  return (
    <div
      className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card"
      title={user.name ?? user.email}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={user.image!}
        alt=""
        className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${showPhoto ? "opacity-100" : "opacity-0"}`}
      />
      <span
        className={`flex size-full items-center justify-center text-[11px] font-semibold transition-opacity duration-500 ${memberColorClass(user.id)} ${showPhoto ? "opacity-0" : "opacity-100"}`}
      >
        {initial}
      </span>
    </div>
  );
}

export function useAlternatingMemberPhotos(intervalMs = 3000): boolean {
  const [showPhotos, setShowPhotos] = useState(true);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const id = window.setInterval(() => {
      setShowPhotos((current) => !current);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [intervalMs]);

  return showPhotos;
}

function useControlledAlternatingMemberPhotos(
  controlled: boolean,
  intervalMs = 3000,
): boolean {
  const [showPhotos, setShowPhotos] = useState(true);

  useEffect(() => {
    if (!controlled) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const id = window.setInterval(() => {
      setShowPhotos((current) => !current);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [controlled, intervalMs]);

  return showPhotos;
}

export function MemberAvatarStack({
  members,
  showPhotos: showPhotosProp,
  className = "",
}: {
  members: MemberUser[];
  showPhotos?: boolean;
  className?: string;
}) {
  const internalShowPhotos = useControlledAlternatingMemberPhotos(showPhotosProp === undefined);
  const showPhotos = showPhotosProp ?? internalShowPhotos;
  const visible = members.slice(0, 5);
  const overflow = members.length - visible.length;

  if (members.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex -space-x-2">
        {visible.map((member) => (
          <MemberAvatar key={member.id} user={member} showPhoto={showPhotos} />
        ))}
      </div>
      {overflow > 0 && (
        <span className="text-xs text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
}
