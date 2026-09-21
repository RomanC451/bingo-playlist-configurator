import { inflateRawSync } from "node:zlib";
import { parseCommentTable } from "./parse-import";
import type { GiveawayComment } from "./types";

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

function findEocd(bytes: Uint8Array): number {
  const min = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (readU32(bytes, i) === EOCD_SIG) return i;
  }
  return -1;
}

function unzip(bytes: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  const eocd = findEocd(bytes);
  if (eocd < 0) return files;
  const count = readU16(bytes, eocd + 10);
  let offset = readU32(bytes, eocd + 16);
  for (let i = 0; i < count; i++) {
    if (readU32(bytes, offset) !== CENTRAL_SIG) break;
    const method = readU16(bytes, offset + 10);
    const compressedSize = readU32(bytes, offset + 20);
    const nameLen = readU16(bytes, offset + 28);
    const extraLen = readU16(bytes, offset + 30);
    const commentLen = readU16(bytes, offset + 32);
    const localOff = readU32(bytes, offset + 42);
    const name = decodeUtf8(bytes.subarray(offset + 46, offset + 46 + nameLen));
    if (readU32(bytes, localOff) === LOCAL_SIG) {
      const localNameLen = readU16(bytes, localOff + 26);
      const localExtraLen = readU16(bytes, localOff + 28);
      const dataStart = localOff + 30 + localNameLen + localExtraLen;
      const packed = bytes.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) files.set(name, packed);
      else if (method === 8) files.set(name, inflateRawSync(packed));
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function columnIndexFromRef(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "";
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return Math.max(0, index - 1);
}

function attr(tag: string, name: string): string {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? "";
}

function sharedStrings(xml: string): string[] {
  const values: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match: RegExpExecArray | null;
  while ((match = siRe.exec(xml))) {
    const texts = [...match[1]!.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((item) =>
      decodeXml(item[1] ?? ""),
    );
    values.push(texts.join(""));
  }
  return values;
}

function sheetRows(xml: string, strings: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml))) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*?)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1]!))) {
      const meta = cellMatch[1] ?? cellMatch[2] ?? "";
      const inner = cellMatch[3] ?? "";
      const index = columnIndexFromRef(attr(meta, "r"));
      const type = attr(meta, "t").toLowerCase();
      let value = "";
      if (type === "inlineStr" || type === "str") {
        value = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
          .map((item) => decodeXml(item[1] ?? ""))
          .join("");
      } else {
        const raw = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? "";
        value = decodeXml(raw);
        if (type === "s" && value) {
          const lookup = Number.parseInt(value, 10);
          value = Number.isFinite(lookup) ? (strings[lookup] ?? "") : "";
        }
      }
      cells[index] = value;
    }
    const width = cells.length;
    const row: string[] = [];
    for (let i = 0; i < width; i++) row.push(cells[i] ?? "");
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

function parseXlsxRows(data: Uint8Array): string[][] {
  if (data.length < 4 || readU32(data, 0) !== LOCAL_SIG) return [];
  const files = unzip(data);
  const strings = sharedStrings(decodeUtf8(files.get("xl/sharedStrings.xml") ?? new Uint8Array()));
  const sheet = files.get("xl/worksheets/sheet1.xml");
  if (!sheet) return [];
  return sheetRows(decodeUtf8(sheet), strings);
}

export function parseXlsxComments(data: Uint8Array): GiveawayComment[] {
  return parseCommentTable(parseXlsxRows(data)) ?? [];
}
