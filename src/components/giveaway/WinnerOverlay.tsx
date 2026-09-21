"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import confetti from "canvas-confetti";
import { GiveawayAvatar } from "@/components/giveaway/GiveawayAvatar";
import {
  animationDuration,
  buildReelStrip,
  buildSpotlightCast,
  buildRaceCast,
  easeOutCubic,
  reelLandingIndex,
  reelOffsetPx,
  buildSpotlightSequence,
  raceLaneProgress,
  sequenceAtProgress,
  type DrawAnimationId,
} from "@/lib/giveaway/draw-animations";
import type { GiveawayComment } from "@/lib/giveaway/types";
import { cn } from "@/lib/utils";

const REEL_ITEM_PX = 88;
const SPOTLIGHT_STEPS = 36;
const BINGO_LOGO = "/bingo.png";
const GIVEAWAY_BANNER = "/bannner.png";
const IG_POST_WIDTH = 1080;
const IG_POST_HEIGHT = 1350;
const IG_SCALE = `min(1, calc((100dvw - 2rem) / ${IG_POST_WIDTH}px), calc((100dvh - 2rem) / ${IG_POST_HEIGHT}px))`;

function ShuffleStage({
  entry,
  spinning,
}: {
  entry: GiveawayComment | null;
  spinning: boolean;
}) {
  return (
    <>
      <div className={cn("flex justify-center", spinning && "animate-pulse")}>
        <GiveawayAvatar
          url={entry?.thumbnailUrl ?? null}
          username={entry?.username ?? "?"}
          size="lg"
        />
      </div>
      <p className="mt-4 break-all text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        @{entry?.username || "…"}
      </p>
      {!spinning && entry?.text ? (
        <p className="mt-3 max-h-24 overflow-auto text-sm text-zinc-400">{entry.text}</p>
      ) : null}
    </>
  );
}

function ReelStage({
  strip,
  progress,
}: {
  strip: GiveawayComment[];
  progress: number;
}) {
  const landingIndex = reelLandingIndex(strip.length);
  const finalOffset = reelOffsetPx(landingIndex, REEL_ITEM_PX);
  const offset = finalOffset * easeOutCubic(progress);
  return (
    <div className="mx-auto w-72 max-w-full">
      <div className="relative h-[264px] shrink-0 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
        <div
          className="pointer-events-none absolute inset-x-2 top-[88px] z-10 h-[88px] rounded-xl ring-2 ring-emerald-400"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 top-0 h-16 z-10 bg-gradient-to-b from-zinc-950 to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 h-16 z-10 bg-gradient-to-t from-zinc-950 to-transparent"
          aria-hidden
        />
        <div style={{ transform: `translateY(${-offset}px)` }}>
          {strip.map((entry, index) => (
            <div
              key={`${entry.id}-${index}`}
              className="flex h-[88px] items-center gap-3 px-4"
            >
              <GiveawayAvatar url={entry.thumbnailUrl} username={entry.username} size="md" />
              <span className="truncate text-sm font-medium text-white">@{entry.username}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RaceStage({
  cast,
  winnerIndex,
  progress,
  spinning,
}: {
  cast: GiveawayComment[];
  winnerIndex: number;
  progress: number;
  spinning: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
      <div className="relative px-3 py-3">
        <div
          className="pointer-events-none absolute inset-y-3 right-10 w-0.5 border-l-2 border-dashed border-amber-400/80"
          aria-hidden
        />
        <p className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400">
          Finish
        </p>
        <ul className="space-y-1.5 pr-12">
          {cast.map((entry, index) => {
            const along = raceLaneProgress(progress, index, winnerIndex);
            const isWinner = index === winnerIndex && (!spinning || progress >= 0.98);
            return (
              <li
                key={entry.id}
                className={cn(
                  "relative h-12 overflow-hidden rounded-lg bg-zinc-950/70",
                  isWinner && "ring-1 ring-amber-400",
                )}
              >
                <div
                  className="absolute inset-y-1 flex items-center gap-2 pl-1"
                  style={{ left: `calc(${along * 100}% - ${along * 2.75}rem)` }}
                >
                  <GiveawayAvatar url={entry.thumbnailUrl} username={entry.username} size="sm" />
                  <span className="max-w-[7rem] truncate text-xs font-medium text-white">
                    @{entry.username}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function SpotlightStage({
  cast,
  sequence,
  progress,
  spinning,
  winnerIndex,
}: {
  cast: GiveawayComment[];
  sequence: number[];
  progress: number;
  spinning: boolean;
  winnerIndex: number;
}) {
  const cols = cast.length > 12 ? 6 : 4;
  const highlight = spinning ? sequenceAtProgress(progress, sequence) : winnerIndex;

  return (
    <div
      className="mx-auto grid max-w-md gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {cast.map((entry, i) => (
        <div
          key={entry.id}
          className={cn(
            "flex justify-center rounded-full p-0.5 transition-transform duration-150",
            i === highlight && "scale-110 ring-2 ring-amber-400",
          )}
        >
          <GiveawayAvatar url={entry.thumbnailUrl} username={entry.username} size="sm" />
        </div>
      ))}
    </div>
  );
}

export function WinnerOverlay({
  entries,
  winner,
  backups,
  target,
  spinning,
  animation,
  onClose,
  onStart,
  onSpinComplete,
}: {
  entries: GiveawayComment[];
  winner: GiveawayComment | null;
  backups: GiveawayComment[];
  target: GiveawayComment | null;
  spinning: boolean;
  animation: DrawAnimationId;
  onClose: () => void;
  onStart: () => void;
  onSpinComplete: () => void;
}) {
  const ready = !spinning && !winner;
  const [progress, setProgress] = useState(0);
  const [shuffleEntry, setShuffleEntry] = useState<GiveawayComment | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const onSpinCompleteRef = useRef(onSpinComplete);
  const onStartRef = useRef(onStart);
  onSpinCompleteRef.current = onSpinComplete;
  onStartRef.current = onStart;

  const reelStrip = useMemo(() => {
    if (!target) return [];
    return buildReelStrip(entries, target);
  }, [entries, target]);

  const raceCast = useMemo(() => {
    if (!target) return entries.slice(0, 6);
    return buildRaceCast(entries, target);
  }, [entries, target]);

  const spotlightCast = useMemo(() => {
    if (!target) return entries.slice(0, 24);
    return buildSpotlightCast(entries, target);
  }, [entries, target]);

  const raceWinnerIndex = target
    ? Math.max(
        0,
        raceCast.findIndex((entry) => entry.id === target.id),
      )
    : 0;
  const spotlightWinnerIndex = target
    ? Math.max(
        0,
        spotlightCast.findIndex((entry) => entry.id === target.id),
      )
    : 0;
  const spotlightSequence = useMemo(
    () => buildSpotlightSequence(spotlightCast.length, spotlightWinnerIndex, SPOTLIGHT_STEPS),
    [spotlightCast, spotlightWinnerIndex],
  );

  useEffect(() => {
    if (!spinning || !target) {
      setProgress(winner ? 1 : 0);
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = animationDuration(animation, reduced);
    const started = performance.now();
    let lastShuffle = 0;
    let raf = 0;
    let finished = false;
    let cancelled = false;

    setProgress(0);
    setShuffleEntry(entries[Math.floor(Math.random() * entries.length)] ?? target);

    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / duration);
      setProgress(p);
      if (animation === "shuffle") {
        const interval = 40 + p * p * 220;
        if (now - lastShuffle >= interval) {
          lastShuffle = now;
          setShuffleEntry(entries[Math.floor(Math.random() * entries.length)] ?? target);
        }
      }
      if (p < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      setShuffleEntry(target);
      if (!finished && !cancelled) {
        finished = true;
        onSpinCompleteRef.current();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [spinning, target, animation, entries]);

  useEffect(() => {
    if (ready || !winner || spinning) return;
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;

    const fire = confetti.create(canvas, { resize: true, useWorker: false });
    const colors = ["#34d399", "#fbbf24", "#f472b6", "#22d3ee", "#ffffff"];
    const burst = {
      colors,
      scalar: 1.25,
      ticks: 260,
      gravity: 0.8,
      decay: 0.88,
      particleCount: 55,
      spread: 92,
      startVelocity: 54,
      disableForReducedMotion: true,
    } as const;

    fire({ ...burst, angle: 60, origin: { x: 0, y: 0.38 } });
    fire({ ...burst, angle: 120, origin: { x: 1, y: 0.38 } });

    return () => {
      fire.reset();
    };
  }, [ready, spinning, winner?.id]);

  useEffect(() => {
    if (!ready || entries.length < 1) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== "NumpadEnter") return;
      if (event.repeat) return;
      event.preventDefault();
      onStartRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ready, entries.length]);

  const shown = winner && !spinning ? winner : shuffleEntry;
  const status = spinning ? "Drawing" : winner ? "Winner" : "Ready";
  const layoutEase =
    "motion-safe:duration-[1400ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-zinc-950/80 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!spinning) onClose();
      }}
    >
      <div
        className="relative shrink-0"
        style={
          {
            ["--ig-scale"]: IG_SCALE,
            width: `calc(${IG_POST_WIDTH}px * var(--ig-scale))`,
            height: `calc(${IG_POST_HEIGHT}px * var(--ig-scale))`,
          } as CSSProperties
        }
        onClick={(event) => event.stopPropagation()}
      >
      <div
        className="relative origin-top-left overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 text-center shadow-2xl"
        style={{
          width: `${IG_POST_WIDTH}px`,
          height: `${IG_POST_HEIGHT}px`,
          transform: "scale(var(--ig-scale))",
        }}
      >
        <canvas
          ref={confettiCanvasRef}
          className="pointer-events-none absolute inset-0 z-[15] h-full w-full"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[26rem] flex-col items-center px-4 pt-2 pb-2">
          <div className="flex min-h-0 w-full flex-1 items-start justify-center">
            <Image
              src={BINGO_LOGO}
              alt="Bingo Muzical"
              width={1080}
              height={480}
              className="h-full w-auto max-w-[96%] object-contain object-top"
              priority
            />
          </div>
          <p className="mt-1 min-h-5 shrink-0 text-sm font-medium uppercase tracking-[0.28em] text-emerald-400">
            {status}
          </p>
        </div>

        <div className="absolute inset-x-0 bottom-[22rem] top-[26rem] flex flex-col px-6">
        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
          <div
            className={cn(
              "flex w-full flex-col items-center justify-center text-center motion-safe:transition-all",
              layoutEase,
              ready
                ? "relative scale-100 opacity-100"
                : "pointer-events-none absolute inset-0 z-10 scale-75 opacity-0",
            )}
          >
            <div className="flex justify-center -space-x-4" aria-hidden>
              {entries.slice(0, 5).map((entry) => (
                <GiveawayAvatar
                  key={entry.id}
                  url={entry.thumbnailUrl}
                  username={entry.username}
                  size="lg"
                />
              ))}
            </div>
            <p className="mt-8 text-5xl font-semibold tracking-tight text-white">Start the draw</p>
          </div>

          <div
            className={cn(
              "motion-safe:transition-all",
              layoutEase,
              ready
                ? "pointer-events-none absolute inset-0 max-h-none scale-90 opacity-0"
                : "relative w-full max-h-full scale-100 opacity-100",
            )}
          >
            {animation === "reel" ? (
              <ReelStage strip={reelStrip} progress={winner && !spinning ? 1 : progress} />
            ) : animation === "race" ? (
              <RaceStage
                cast={raceCast}
                winnerIndex={raceWinnerIndex}
                progress={winner && !spinning ? 1 : progress}
                spinning={spinning}
              />
            ) : animation === "spotlight" ? (
              <SpotlightStage
                cast={spotlightCast}
                sequence={spotlightSequence}
                winnerIndex={spotlightWinnerIndex}
                progress={winner && !spinning ? 1 : progress}
                spinning={spinning}
              />
            ) : (
              <ShuffleStage entry={shown} spinning={spinning} />
            )}
            {animation !== "shuffle" ? (
              <>
                <p className="mt-4 break-all text-3xl font-semibold tracking-tight text-white">
                  {spinning ? "…" : `@${winner?.username ?? target?.username ?? ""}`}
                </p>
                {animation === "reel" && !spinning && winner?.text ? (
                  <p className="mt-2 max-h-24 overflow-auto text-sm text-zinc-400">{winner.text}</p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center px-6">
          <div
            className={cn(
              "w-full overflow-hidden motion-safe:transition-all",
              layoutEase,
              !spinning && winner ? "max-h-[22rem] opacity-100" : "max-h-0 opacity-0",
            )}
          >
            {winner ? (
              <>
                {animation !== "shuffle" && animation !== "reel" ? (
                  <p className="max-h-24 overflow-auto text-sm text-zinc-400">
                    {winner.text || "No comment text"}
                  </p>
                ) : null}
                {backups.length ? (
                  <>
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.28em] text-zinc-500">
                      De rezervă
                    </p>
                    <ul className="mt-3 flex justify-center gap-10">
                    {backups.map((entry, index) => (
                      <li key={entry.id} className="flex max-w-[12rem] flex-col items-center gap-1.5">
                        <span className="text-xs font-medium text-zinc-500">
                          {index === 0 ? "2nd" : index === 1 ? "3rd" : `${index + 2}th`}
                        </span>
                        <GiveawayAvatar
                          url={entry.thumbnailUrl}
                          username={entry.username}
                          size="md"
                        />
                        <span className="break-all text-center text-sm text-zinc-300">
                          @{entry.username}
                        </span>
                      </li>
                    ))}
                  </ul>
                  </>
                ) : null}
              </>
            ) : null}
          </div>

          <div
            className={cn(
              "relative flex flex-col items-center justify-center overflow-hidden motion-safe:transition-all",
              layoutEase,
              ready ? "mt-6 min-h-20" : "mt-0 max-h-0 min-h-0",
            )}
          >
            <button
              type="button"
              onClick={onStart}
              disabled={!ready || entries.length < 1}
              className={cn(
                "rounded-full border border-white/25 bg-white px-14 py-4 text-2xl font-semibold uppercase tracking-[0.22em] text-zinc-950",
                "hover:bg-zinc-100 disabled:opacity-40",
                "motion-safe:transition-all",
                layoutEase,
                ready
                  ? "relative scale-100 opacity-100"
                  : "pointer-events-none invisible absolute scale-75 opacity-0",
              )}
            >
              Start
            </button>
          </div>
        </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[22rem] px-6 pb-8 pt-2">
          <Image
            src={GIVEAWAY_BANNER}
            alt="Transformă distracția în șanse la educație"
            width={960}
            height={280}
            className="mx-auto h-full w-full object-contain"
          />
        </div>
      </div>
      </div>
    </div>
  );
}
