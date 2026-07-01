"use client";

import { useEffect, useRef, useState } from "react";
import type { TrackEditingBy } from "@/lib/track-edit-lock";
import { readJsonResponse } from "@/lib/read-json-response";

const HEARTBEAT_MS = 30_000;

type LockState =
  | { status: "loading" }
  | { status: "ready"; isHolder: true }
  | { status: "blocked"; editingBy: TrackEditingBy };

export function useTrackEditLock(sessionId: string, clipId: string) {
  const [state, setState] = useState<LockState>({ status: "loading" });
  const heldRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let heartbeatId: ReturnType<typeof setInterval> | null = null;

    async function acquire() {
      const res = await fetch(`/api/sessions/${sessionId}/tracks/${clipId}/lock`, {
        method: "POST",
      });
      const body = await readJsonResponse<{
        error?: string;
        editingBy?: TrackEditingBy;
      }>(res);

      if (cancelled) return;

      if (res.status === 409 && body.editingBy) {
        heldRef.current = false;
        setState({ status: "blocked", editingBy: body.editingBy });
        return;
      }

      if (!res.ok) {
        heldRef.current = false;
        setState({
          status: "blocked",
          editingBy: {
            userId: "",
            name: body.error ?? "Unable to acquire edit lock",
            image: null,
          },
        });
        return;
      }

      heldRef.current = true;
      setState({ status: "ready", isHolder: true });
    }

    void acquire();

    heartbeatId = setInterval(() => {
      void fetch(`/api/sessions/${sessionId}/tracks/${clipId}/lock`, {
        method: "POST",
      });
    }, HEARTBEAT_MS);

    function release() {
      if (!heldRef.current) return;
      void fetch(`/api/sessions/${sessionId}/tracks/${clipId}/lock`, {
        method: "DELETE",
        keepalive: true,
      });
      heldRef.current = false;
    }

    function onPageHide() {
      release();
    }

    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      if (heartbeatId) clearInterval(heartbeatId);
      window.removeEventListener("pagehide", onPageHide);
      release();
    };
  }, [sessionId, clipId]);

  return state;
}
