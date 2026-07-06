"use client";

import { useEffect, useState } from "react";

/** Bumps when tutorial completion changes so menus can re-read localStorage. */
export function useTutorialCompletionRevision(): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    function bump() {
      setRevision((value) => value + 1);
    }

    window.addEventListener("tutorial-completed", bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener("tutorial-completed", bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  return revision;
}
