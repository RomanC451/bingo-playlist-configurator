"use client";

import { useEffect, useState } from "react";
import {
  guestReviewIdStorageKey,
  guestReviewNameStorageKey,
} from "@/lib/guest-review-shared";

export function useGuestReviewIdentity(shareToken: string | null) {
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestName, setGuestNameState] = useState("");

  useEffect(() => {
    if (!shareToken) {
      setGuestId(null);
      setGuestNameState("");
      return;
    }

    const idKey = guestReviewIdStorageKey(shareToken);
    let id = localStorage.getItem(idKey);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(idKey, id);
    }
    setGuestId(id);

    const nameKey = guestReviewNameStorageKey(shareToken);
    setGuestNameState(localStorage.getItem(nameKey) ?? "");
  }, [shareToken]);

  function setGuestName(name: string) {
    const trimmed = name.trim();
    setGuestNameState(name);
    if (!shareToken) return;
    const nameKey = guestReviewNameStorageKey(shareToken);
    if (trimmed) {
      localStorage.setItem(nameKey, trimmed);
    } else {
      localStorage.removeItem(nameKey);
    }
  }

  return { guestId, guestName, setGuestName };
}
