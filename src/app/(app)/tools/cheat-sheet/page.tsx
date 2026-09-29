"use client";

import { useMemo, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dropzone,
  DropZoneArea,
  DropzoneDescription,
  DropzoneFileList,
  DropzoneFileListItem,
  DropzoneMessage,
  DropzoneRemoveFile,
  DropzoneTrigger,
  useDropzone,
} from "@/components/ui/dropzone";
import { errorMessageFromBody } from "@/lib/api-errors";
import { displayWinLabel, formatCheatSheetText } from "@/lib/cheat-sheet/wins";
import { generateCheatSheetPdf } from "@/lib/cheat-sheet/export-pdf";
import {
  MAX_DIAGONAL_WINS,
  MAX_GENERATED_CARDS,
  MAX_LINE_WINS,
  SUPPORTED_GRID_SIZES,
  type CheatSheetResult,
  type WinRules,
} from "@/lib/cheat-sheet/types";
import { readJsonResponse } from "@/lib/read-json-response";

type CheatSheetSource = "pdf" | "spotify";
type GridSize = (typeof SUPPORTED_GRID_SIZES)[number];

type CheatSheetResponse = CheatSheetResult & {
  playlistName: string;
  playlistImageUrl: string | null;
  text: string;
  cardsPdfBase64?: string;
  error?: string;
};

const DEFAULT_RULES: WinRules = {
  lines: 2,
  diagonals: 2,
  fullCard: true,
};

const MAX_PDF_BYTES = 15 * 1024 * 1024;

function countRuleHelp(kind: "line" | "diagonal", count: number): string {
  if (count <= 0) return "";
  const singular = kind === "line" ? "line" : "diagonal";
  const plural = kind === "line" ? "lines" : "diagonals";
  if (count === 1) return `First to 1 ${singular}`;
  if (count === 2) return `First to 1 ${singular} and first to 2 ${plural}`;
  return `First to 1 ${singular} through first to ${count} ${plural}`;
}

function RuleCountRow({
  label,
  count,
  max,
  kind,
  onToggle,
  onCountChange,
}: {
  label: string;
  count: number;
  max: number;
  kind: "line" | "diagonal";
  onToggle: () => void;
  onCountChange: (value: number) => void;
}) {
  const enabled = count > 0;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={onToggle} />
          {label}
        </label>
        {enabled ? (
          <input
            type="number"
            min={1}
            max={max}
            value={count}
            onChange={(event) => {
              const value = Number(event.target.value);
              onCountChange(Number.isFinite(value) && value > 0 ? value : 1);
            }}
            className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            aria-label={`${label} count`}
          />
        ) : null}
      </div>
      {enabled ? <p className="pl-6 text-xs text-zinc-500">{countRuleHelp(kind, count)}</p> : null}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function pdfBlob(bytes: Uint8Array) {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy], { type: "application/pdf" });
}

function SourceToggle({
  source,
  onChange,
}: {
  source: CheatSheetSource;
  onChange: (source: CheatSheetSource) => void;
}) {
  const options: Array<{ id: CheatSheetSource; label: string }> = [
    { id: "pdf", label: "Upload PDF" },
    { id: "spotify", label: "Spotify playlist" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
      {options.map((option) => {
        const selected = source === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={
              selected
                ? "rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PdfDropzone({ onFileChange }: { onFileChange: (file: File | null) => void }) {
  const dropzone = useDropzone({
    onDropFile: async (file) => {
      onFileChange(file);
      return { status: "success" as const, result: file.name };
    },
    onRemoveFile: async () => {
      onFileChange(null);
    },
    validation: {
      accept: { "application/pdf": [".pdf"] },
      maxSize: MAX_PDF_BYTES,
      maxFiles: 1,
    },
    shiftOnMaxFiles: true,
  });

  return (
    <Dropzone {...dropzone}>
      <div>
        <p className="text-sm font-medium">Bingo cards PDF</p>
        <DropzoneDescription>
          Drag and drop a PDF, or click to browse. The song list at the end is used for play order.
        </DropzoneDescription>
        <DropZoneArea
          className={
            dropzone.isDragActive
              ? "min-h-40 border-dashed border-emerald-500 bg-emerald-50/60 p-0 dark:bg-emerald-950/30"
              : "min-h-40 border-dashed p-0"
          }
        >
          <DropzoneTrigger className="flex min-h-40 w-full flex-col items-center justify-center gap-2 bg-transparent px-6 py-8 text-center hover:bg-transparent">
            <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium">
              {dropzone.isDragActive ? "Drop the PDF here" : "Drop a bingo-cards PDF here"}
            </span>
            <span className="text-xs text-muted-foreground">PDF up to 15 MB</span>
          </DropzoneTrigger>
        </DropZoneArea>
        <DropzoneMessage />
        <DropzoneFileList className="mt-3">
          {dropzone.fileStatuses.map((file) => (
            <DropzoneFileListItem
              key={file.id}
              file={file}
              className="flex-row items-center justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.file.size)}</p>
                </div>
              </div>
              <DropzoneRemoveFile variant="ghost" className="shrink-0">
                <X className="size-4" />
              </DropzoneRemoveFile>
            </DropzoneFileListItem>
          ))}
        </DropzoneFileList>
      </div>
    </Dropzone>
  );
}

function SpotifyOptions({
  playlistUrl,
  gridSize,
  cardCount,
  includeArtist,
  freeCenter,
  onPlaylistUrlChange,
  onGridSizeChange,
  onCardCountChange,
  onIncludeArtistChange,
  onFreeCenterChange,
}: {
  playlistUrl: string;
  gridSize: GridSize;
  cardCount: number;
  includeArtist: boolean;
  freeCenter: boolean;
  onPlaylistUrlChange: (value: string) => void;
  onGridSizeChange: (value: GridSize) => void;
  onCardCountChange: (value: number) => void;
  onIncludeArtistChange: (value: boolean) => void;
  onFreeCenterChange: (value: boolean) => void;
}) {
  const oddGrid = gridSize % 2 === 1;
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="cheat-sheet-playlist">
          Spotify playlist
        </label>
        <input
          id="cheat-sheet-playlist"
          type="text"
          required
          placeholder="https://open.spotify.com/playlist/..."
          value={playlistUrl}
          onChange={(event) => onPlaylistUrlChange(event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Uses the same card generator as bingo-cards. The playlist needs to be public.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium" htmlFor="cheat-sheet-grid">
            Grid size
          </label>
          <select
            id="cheat-sheet-grid"
            value={gridSize}
            onChange={(event) => onGridSizeChange(Number(event.target.value) as GridSize)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {SUPPORTED_GRID_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}×{size}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="cheat-sheet-cards">
            Number of cards
          </label>
          <input
            id="cheat-sheet-cards"
            type="number"
            min={1}
            max={MAX_GENERATED_CARDS}
            value={cardCount}
            onChange={(event) => {
              const value = Number(event.target.value);
              onCardCountChange(
                Number.isFinite(value) ? Math.min(MAX_GENERATED_CARDS, Math.max(1, Math.trunc(value))) : 1,
              );
            }}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeArtist}
          onChange={(event) => onIncludeArtistChange(event.target.checked)}
        />
        Include artist names on cards
      </label>
      <div>
        <label className={`flex items-center gap-2 text-sm ${oddGrid ? "" : "opacity-50"}`}>
          <input
            type="checkbox"
            checked={oddGrid && freeCenter}
            disabled={!oddGrid}
            onChange={(event) => onFreeCenterChange(event.target.checked)}
          />
          Free center space
        </label>
        <p className="mt-1 pl-6 text-xs text-zinc-500">Odd grids only (3×3 and 5×5).</p>
      </div>
    </div>
  );
}

export default function CheatSheetToolPage() {
  const [source, setSource] = useState<CheatSheetSource>("pdf");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [gridSize, setGridSize] = useState<GridSize>(5);
  const [cardCount, setCardCount] = useState(20);
  const [includeArtist, setIncludeArtist] = useState(false);
  const [freeCenter, setFreeCenter] = useState(true);
  const [rules, setRules] = useState<WinRules>(DEFAULT_RULES);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheatSheetResponse | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const hasWinRule = rules.lines > 0 || rules.diagonals > 0 || rules.fullCard;
  const canGenerate =
    hasWinRule && (source === "pdf" ? Boolean(pdfFile) : Boolean(playlistUrl.trim()));

  const downloadStem = useMemo(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = (result?.playlistName ?? "bingo")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return `${slug || "bingo"}-cheat-sheet-${stamp}`;
  }, [result?.playlistName]);

  const cardsPdfStem = useMemo(
    () => downloadStem.replace(/-cheat-sheet-/, "-bingo-cards-"),
    [downloadStem],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (source === "pdf" && !pdfFile) {
      setError("Choose a bingo cards PDF.");
      return;
    }
    if (source === "spotify" && !playlistUrl.trim()) {
      setError("Paste a Spotify playlist URL.");
      return;
    }
    if (!hasWinRule) {
      setError("Select at least one win rule.");
      return;
    }

    setLoading(true);
    setError(null);

    const body = new FormData();
    body.append("source", source);
    body.append("rules", JSON.stringify(rules));
    if (source === "pdf" && pdfFile) {
      body.append("pdf", pdfFile);
    }
    if (source === "spotify") {
      body.append(
        "generation",
        JSON.stringify({
          playlistUrl: playlistUrl.trim(),
          gridSize,
          cardCount,
          includeArtist,
          freeCenter,
        }),
      );
    }

    try {
      const res = await fetch("/api/tools/cheat-sheet", {
        method: "POST",
        body,
      });
      const data = await readJsonResponse<CheatSheetResponse>(res);
      if (!res.ok) {
        setResult(null);
        setError(errorMessageFromBody(data, "Failed to generate cheat sheet"));
        return;
      }
      setResult(data);
    } catch {
      setResult(null);
      setError("Failed to generate cheat sheet");
    } finally {
      setLoading(false);
    }
  }

  function setRuleCount(key: "lines" | "diagonals", value: number) {
    const max = key === "lines" ? MAX_LINE_WINS : MAX_DIAGONAL_WINS;
    const next = Number.isFinite(value) ? Math.min(max, Math.max(0, Math.trunc(value))) : 0;
    setRules((current) => ({ ...current, [key]: next }));
  }

  function toggleCountRule(key: "lines" | "diagonals") {
    setRules((current) => ({
      ...current,
      [key]: current[key] > 0 ? 0 : key === "diagonals" ? MAX_DIAGONAL_WINS : 2,
    }));
  }

  function toggleFullCard() {
    setRules((current) => ({ ...current, fullCard: !current.fullCard }));
  }

  function downloadText() {
    if (!result) return;
    const text = result.text || formatCheatSheetText(result, result.playlistName);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${downloadStem}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    if (!result) return;
    setExportingPdf(true);
    try {
      const bytes = await generateCheatSheetPdf(result, result.playlistName);
      const blob = pdfBlob(bytes);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${downloadStem}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  }

  function downloadCardsPdf() {
    if (!result?.cardsPdfBase64) return;
    const blob = pdfBlob(base64ToBytes(result.cardsPdfBase64));
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${cardsPdfStem}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <Breadcrumb
        className="mb-4 print:hidden"
        items={[{ label: "Tools", href: "/tools" }, { label: "Cheat sheet" }]}
      />

      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">Cheat sheet</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Upload an existing bingo-cards PDF, or generate one from a Spotify playlist. Play
          order comes from the song list in the PDF. Existing cheat-sheet pages are ignored.
          Lines are rows and columns only. Diagonals are a separate prize.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4 print:hidden">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <SourceToggle source={source} onChange={setSource} />

        {source === "pdf" ? (
          <PdfDropzone onFileChange={setPdfFile} />
        ) : (
          <SpotifyOptions
            playlistUrl={playlistUrl}
            gridSize={gridSize}
            cardCount={cardCount}
            includeArtist={includeArtist}
            freeCenter={freeCenter}
            onPlaylistUrlChange={setPlaylistUrl}
            onGridSizeChange={setGridSize}
            onCardCountChange={setCardCount}
            onIncludeArtistChange={setIncludeArtist}
            onFreeCenterChange={setFreeCenter}
          />
        )}

        <fieldset>
          <legend className="text-sm font-medium">Win rules</legend>
          <div className="mt-2 space-y-3 text-sm">
            <RuleCountRow
              label="Lines (rows and columns)"
              kind="line"
              count={rules.lines}
              max={MAX_LINE_WINS}
              onToggle={() => toggleCountRule("lines")}
              onCountChange={(value) => setRuleCount("lines", value)}
            />
            <RuleCountRow
              label="Diagonals"
              kind="diagonal"
              count={rules.diagonals}
              max={MAX_DIAGONAL_WINS}
              onToggle={() => toggleCountRule("diagonals")}
              onCountChange={(value) => setRuleCount("diagonals", value)}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rules.fullCard}
                onChange={toggleFullCard}
              />
              Full-card
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={loading || !canGenerate}
          className="w-full rounded-lg bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:px-6"
        >
          {loading
            ? source === "spotify"
              ? "Generating cards…"
              : "Calculating…"
            : "Generate cheat sheet"}
        </button>
      </form>

      {result && (
        <div className="mt-10">
          <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Timeline of wins</h2>
              <p className="text-sm text-zinc-500">
                {result.cardCount} cards · {result.gridSize}×{result.gridSize} ·{" "}
                {result.playlistName}
                {result.rules.lines > 0 ? ` · lines to ${result.rules.lines}` : ""}
                {result.rules.diagonals > 0 ? ` · diagonals to ${result.rules.diagonals}` : ""}
                {result.rules.fullCard ? " · full-card" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.cardsPdfBase64 ? (
                <Button type="button" variant="outline" onClick={downloadCardsPdf}>
                  Download cards PDF
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={downloadText}>
                Download .txt
              </Button>
              <Button type="button" onClick={() => void downloadPdf()} disabled={exportingPdf}>
                {exportingPdf ? "Building PDF…" : "Download cheat sheet PDF"}
              </Button>
            </div>
          </div>

          {result.unmatched.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 print:hidden dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {result.unmatched.length} card square{result.unmatched.length === 1 ? "" : "s"} did
              not match a playlist track. Those cells cannot complete on their own.
            </div>
          )}

          <div className="mt-6 space-y-4">
            {result.timeline.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No wins with the selected rules and this playlist order.
              </p>
            ) : (
              result.timeline.map((song) => (
                <section
                  key={`${song.songNumber}-${song.trackName}`}
                  className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <h3 className="font-medium">
                    Song #{song.songNumber}: {song.trackName}
                    {song.artistName ? ` — ${song.artistName}` : ""}
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {song.events.map((event) => {
                      const win = displayWinLabel(event.label);
                      return (
                        <li key={`${event.cardNumber}-${event.label}`}>
                          Card {event.cardNumber} wins{" "}
                          {win.isFirst ? <strong className="font-bold">{win.text}</strong> : win.text}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>

          <details className="mt-8 print:hidden">
            <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Parsed cards
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {result.cards.map((card) => (
                <div
                  key={card.cardNumber}
                  className="overflow-x-auto rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <p className="mb-2 text-sm font-medium">Card #{card.cardNumber}</p>
                  <table className="w-full table-fixed border-collapse text-[11px]">
                    <tbody>
                      {card.songsMatrix.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, colIndex) => (
                            <td
                              key={colIndex}
                              className="border border-zinc-200 px-1 py-1 align-top dark:border-zinc-700"
                            >
                              {cell || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
