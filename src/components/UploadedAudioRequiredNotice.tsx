export function UploadedAudioRequiredNotice({
  sessionId,
  className,
}: {
  sessionId?: string;
  className?: string;
}) {
  return (
    <div
      data-tutorial="uploaded-audio-notice"
      className={
        className ??
        "rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      }
    >
      Upload MP3 files for every track from the session edit page before previewing here.
      {sessionId ? (
        <>
          {" "}
          <a
            href={`/sessions/${sessionId}/edit?uploadAudio=1`}
            className="font-medium underline"
          >
            Upload session audio
          </a>
        </>
      ) : null}
    </div>
  );
}
