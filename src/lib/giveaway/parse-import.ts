import type { GiveawayComment } from "./types";

function truthyReply(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "reply"].includes(value.trim().toLowerCase());
}

function commentUrlLooksLikeReply(url: string | undefined): boolean {
  if (!url) return false;
  return /\/(r|replies?)\//i.test(url) || /\/c\/[^/]+\/c\//i.test(url);
}

export function parseCsvRows(raw: string): string[][] {
  const text = raw.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((value) => value.trim().length > 0)) {
      rows.push(row.map((value) => value.trim()));
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
        continue;
      }
      cell += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      pushRow();
      continue;
    }
    if (char === "\r") {
      continue;
    }
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

function headerKey(cell: string): string {
  return cell.replace(/^"|"$/g, "").trim().toLowerCase();
}

function columnIndex(headers: string[], names: string[]): number {
  for (const name of names) {
    const index = headers.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

function commentFromParts(
  id: string,
  username: string,
  text: string,
  isReply: boolean,
  displayName?: string,
  createdAt?: string,
  thumbnailUrl?: string,
): GiveawayComment | null {
  const handle = username.replace(/^@/, "").trim();
  if (!handle) return null;
  const name = displayName?.replace(/^@/, "").trim();
  const photo = thumbnailUrl?.trim() ?? "";
  return {
    id,
    username: handle,
    displayName: name || handle,
    text: text.trim(),
    createdAt: createdAt?.trim() || null,
    isReply,
    thumbnailUrl: /^https?:\/\//i.test(photo) ? photo : null,
  };
}

function looksLikeCommentHeaders(headers: string[]): boolean {
  return (
    columnIndex(headers, ["username", "user name", "handle"]) >= 0 &&
    columnIndex(headers, ["comment", "text", "message"]) >= 0
  );
}

function headerRowIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i++) {
    if (looksLikeCommentHeaders(rows[i]!.map(headerKey))) return i;
  }
  return -1;
}

export function parseCommentTable(rows: string[][]): GiveawayComment[] | null {
  const start = headerRowIndex(rows);
  if (start < 0 || start >= rows.length - 1) return null;
  const headers = rows[start]!.map(headerKey);
  const usernameIndex = columnIndex(headers, ["username", "user name", "handle"]);
  const textIndex = columnIndex(headers, ["comment", "text", "message"]);
  if (usernameIndex < 0 || textIndex < 0) return null;

  const nameIndex = columnIndex(headers, ["name", "display name"]);
  const idIndex = columnIndex(headers, ["comment id", "id"]);
  const dateIndex = columnIndex(headers, ["date", "created at", "timestamp"]);
  const replyIndex = columnIndex(headers, ["isreply", "is_reply", "reply"]);
  const urlIndex = columnIndex(headers, ["comment url"]);
  const thumbnailIndex = columnIndex(headers, ["thumbnail", "photo", "avatar", "picture", "image"]);

  const comments: GiveawayComment[] = [];
  for (let i = start + 1; i < rows.length; i++) {
    const cells = rows[i]!;
    const parsed = commentFromParts(
      cells[idIndex] || `import-${i}`,
      cells[usernameIndex] ?? "",
      cells[textIndex] ?? "",
      truthyReply(cells[replyIndex]) || commentUrlLooksLikeReply(cells[urlIndex]),
      nameIndex >= 0 ? cells[nameIndex] : undefined,
      dateIndex >= 0 ? cells[dateIndex] : undefined,
      thumbnailIndex >= 0 ? cells[thumbnailIndex] : undefined,
    );
    if (parsed) comments.push(parsed);
  }
  return comments;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function lowerRecord(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    next[key.toLowerCase()] = entry;
  }
  return next;
}

function fieldString(record: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function exportRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.comments)) return payload.comments;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

export function parseExportCommentsJson(payload: unknown): GiveawayComment[] {
  const rows = exportRows(payload);
  const comments: GiveawayComment[] = [];
  for (let i = 0; i < rows.length; i++) {
    const record = lowerRecord(rows[i]);
    if (!record) continue;
    const parsed = commentFromParts(
      fieldString(record, ["comment id", "comment_id", "commentid", "id"]) || `import-${i + 1}`,
      fieldString(record, ["username", "user name", "handle", "author", "author_name", "authorname"]),
      fieldString(record, ["comment", "text", "message"]),
      truthyReply(fieldString(record, ["isreply", "is_reply", "reply"])) ||
        commentUrlLooksLikeReply(fieldString(record, ["comment url", "comment_url", "commenturl"])),
      fieldString(record, ["name", "display name", "display_name", "author_name"]) || undefined,
      fieldString(record, ["date", "created at", "created_at", "timestamp"]) || undefined,
      fieldString(record, ["thumbnail", "photo", "avatar", "picture", "image", "profile_picture"]) ||
        undefined,
    );
    if (parsed) comments.push(parsed);
  }
  return comments;
}

export function parseImportedComments(raw: string): GiveawayComment[] {
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return [];
  if (/^<!DOCTYPE html|<html[\s>]/i.test(trimmed)) return [];

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const fromJson = parseExportCommentsJson(JSON.parse(trimmed) as unknown);
      if (fromJson.length) return fromJson;
    } catch {
      // fall through to CSV / line parsing
    }
  }

  const csvComments = parseCommentTable(parseCsvRows(raw));
  if (csvComments) return csvComments;

  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (!lines.length) return [];

  const comments: GiveawayComment[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const matched = line.match(/^@?([^\s:]+)[:\s]\s*(.*)$/);
    if (matched?.[1] && matched[2] !== undefined && matched[2].length > 0) {
      const parsed = commentFromParts(`import-${i + 1}`, matched[1], matched[2], false);
      if (parsed) comments.push(parsed);
      continue;
    }
    const usernameOnly = commentFromParts(`import-${i + 1}`, line.replace(/^@/, ""), "", false);
    if (usernameOnly) comments.push(usernameOnly);
  }
  return comments;
}

function mergeKey(comment: GiveawayComment): string {
  if (comment.id && !comment.id.startsWith("import-")) return comment.id;
  return `${comment.username}\n${comment.text}\n${comment.createdAt ?? ""}`;
}

export function mergeImportedComments(
  existing: GiveawayComment[],
  incoming: GiveawayComment[],
): GiveawayComment[] {
  const merged = new Map<string, GiveawayComment>();
  for (const comment of [...existing, ...incoming]) {
    const key = mergeKey(comment);
    const previous = merged.get(key);
    if (!previous || (!previous.thumbnailUrl && comment.thumbnailUrl)) {
      merged.set(key, comment);
    }
  }
  return [...merged.values()];
}
