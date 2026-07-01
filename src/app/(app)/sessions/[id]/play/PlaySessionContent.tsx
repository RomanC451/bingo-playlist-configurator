"use client";

import { useCallback, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PlaybackControls } from "@/components/PlaybackControls";
import { readJsonResponse } from "@/lib/read-json-response";

interface PlaySessionContentProps {
  sessionId: string;
}

export function PlaySessionContent({ sessionId }: PlaySessionContentProps) {
  const [sessionName, setSessionName] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) return;
    const data = await readJsonResponse<{ name: string }>(res);
    setSessionName(data.name);
  }, [sessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  return (
    <div>
      <Breadcrumb
        className="mb-4"
        items={[
          { label: "Bingo sessions", href: "/sessions" },
          {
            label: sessionName ?? "Session",
            href: `/sessions/${sessionId}/edit`,
            skeleton: !sessionName,
          },
          { label: "Live playback" },
        ]}
      />
      <h1 className="text-2xl font-semibold">Live playback</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Clips auto-seek to the start point. Press Next when you are ready to advance.
      </p>
      <div className="mt-8">
        <PlaybackControls sessionId={sessionId} />
      </div>
    </div>
  );
}
