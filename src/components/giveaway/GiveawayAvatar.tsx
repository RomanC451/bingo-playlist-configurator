"use client";

import { useState } from "react";
import { giveawayAvatarSrc } from "@/lib/giveaway/avatar";

export function GiveawayAvatar({
  url,
  username,
  size,
}: {
  url: string | null;
  username: string;
  size: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const src = giveawayAvatarSrc(url);
  const className =
    size === "lg"
      ? "size-28 rounded-full object-cover ring-4 ring-emerald-400/40"
      : size === "md"
        ? "size-16 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800"
        : "size-10 shrink-0 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800";
  if (!src || failed) {
    return (
      <span
        className={`${className} flex items-center justify-center text-sm font-medium text-zinc-500`}
        aria-hidden
      >
        {(username[0] ?? "?").toUpperCase()}
      </span>
    );
  }
  return (
    // Proxied through /api/tools/giveaway/avatar so Instagram CDN thumbs can load.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} onError={() => setFailed(true)} />
  );
}
