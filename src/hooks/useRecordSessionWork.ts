import { useEffect } from "react";

export function useRecordSessionWork(sessionId: string | undefined) {
  useEffect(() => {
    if (!sessionId) return;
    void fetch(`/api/sessions/${sessionId}/work`, { method: "POST" });
  }, [sessionId]);
}
