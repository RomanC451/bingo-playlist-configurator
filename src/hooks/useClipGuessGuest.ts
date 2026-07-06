"use client";

import { useCallback, useEffect, useState } from "react";
import { guestStorageKey } from "@/lib/clip-guess-shared";

export function useClipGuessGuestId(shareToken: string | null) {
  const [guestId, setGuestId] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) {
      setGuestId(null);
      return;
    }

    const key = guestStorageKey(shareToken);
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    setGuestId(id);
  }, [shareToken]);

  return guestId;
}
