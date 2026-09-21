import { parseExportCommentsJson, parseImportedComments } from "./parse-import";
import { parseXlsxComments } from "./parse-xlsx";
import type { GiveawayComment } from "./types";

export const EXPORTCOMMENTS_ORIGIN = "https://exportcomments.com";
export const EXPORTCOMMENTS_API_BASE = `${EXPORTCOMMENTS_ORIGIN}/api/v1`;

const BROWSER_HEADERS = {
  Origin: EXPORTCOMMENTS_ORIGIN,
  Referer: `${EXPORTCOMMENTS_ORIGIN}/`,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const ALLOWED_HOSTS = new Set([
  "instagram.com",
  "instagr.am",
  "facebook.com",
  "fb.com",
  "fb.watch",
  "m.facebook.com",
]);

export class ExportCommentsError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly code?: string,
    readonly startUrl?: string,
  ) {
    super(message);
    this.name = "ExportCommentsError";
  }
}

export type ExportCommentsDeps = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollIntervalMs?: number;
  timeoutMs?: number;
  requestTimeoutMs?: number;
};

export type ExportedComments = {
  comments: GiveawayComment[];
  guid: string;
  sourceUrl: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function exportCommentsStartUrl(postUrl: string): string {
  const url = new URL(EXPORTCOMMENTS_ORIGIN);
  url.searchParams.set("url", postUrl);
  return url.toString();
}

const GUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export type ExportCommentsInput =
  | { type: "post"; url: string }
  | { type: "guid"; guid: string }
  | { type: "csv"; url: string };

export function parseExportCommentsInput(input: string): ExportCommentsInput | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "exportcomments.com" || host.endsWith(".exportcomments.com")) {
      if (parsed.pathname.includes("/exports/") && /\.csv$/i.test(parsed.pathname)) {
        return { type: "csv", url: parsed.toString() };
      }
      const guid = parsed.pathname.match(GUID_PATTERN)?.[0];
      if (guid) return { type: "guid", guid };
    }
  } catch {
    // not a URL
  }

  const guidOnly = trimmed.match(new RegExp(`^${GUID_PATTERN.source}$`, "i"));
  if (guidOnly?.[0]) return { type: "guid", guid: guidOnly[0] };

  const post = normalizePostUrl(trimmed);
  if (post) return { type: "post", url: post };
  return null;
}

export function normalizePostUrl(input: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;
  parsed.hash = "";
  parsed.search = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed.toString();
}

function unwrapJob(payload: unknown): Record<string, unknown> | null {
  if (Array.isArray(payload) && payload[0] && isRecord(payload[0])) {
    return unwrapJob(payload[0]);
  }
  if (!isRecord(payload)) return null;
  if (isRecord(payload.comment)) return unwrapJob(payload.comment);
  if (Array.isArray(payload.data) && payload.data[0]) return unwrapJob(payload.data[0]);
  if (isRecord(payload.data) && (payload.data.guid || payload.data.status)) return payload.data;
  return payload;
}

function extractGuid(payload: unknown): string {
  const job = unwrapJob(payload);
  const fromJob = asString(job?.guid).trim();
  if (fromJob) return fromJob;
  if (isRecord(payload) && asString(payload.error) === "export.unfinished") {
    return asString(payload.guid).trim();
  }
  return "";
}

function jobErrorMessage(job: Record<string, unknown>, fallback: string): string {
  const nested = isRecord(job.details) ? job.details : {};
  return (
    asString(job.error).trim() ||
    asString(job.error_message).trim() ||
    asString(nested.error).trim() ||
    fallback
  );
}

function apiErrorMessage(payload: unknown, status: number, fallback: string): string {
  const code = isRecord(payload) ? asString(payload.error).trim() : "";
  if (code === "need_captcha") {
    return "ExportComments needs a quick check in their tab. Open the site, wait until the export finishes, then paste the /done/ link here and fetch again.";
  }
  if (code === "export.paid_only") {
    return "This export option is paid on ExportComments. Try without extra options, or download the CSV from their site.";
  }
  if (isRecord(payload)) {
    const detail =
      asString(payload.error_message).trim() ||
      asString(payload.detail).trim() ||
      asString(payload.message).trim();
    if (code && code !== "OK") return code;
    if (detail) return detail;
  }
  return status ? `${fallback} (${status})` : fallback;
}

async function readJson(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

async function requestJson(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ status: number; body: unknown }> {
  let response: Response;
  try {
    const method = (init.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {
      ...BROWSER_HEADERS,
      Accept: "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (method !== "GET") headers["Content-Type"] = "application/json";
    response = await fetchFn(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new ExportCommentsError("Timed out talking to ExportComments.", 504);
    }
    throw new ExportCommentsError("Could not reach ExportComments.");
  }
  return { status: response.status, body: await readJson(response) };
}

async function requestText(
  fetchFn: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<{ status: number; body: string }> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "GET",
      headers: {
        ...BROWSER_HEADERS,
        Accept: "text/csv,text/plain,application/json,*/*",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new ExportCommentsError("Timed out downloading the ExportComments CSV.", 504);
    }
    throw new ExportCommentsError("Could not download comments from ExportComments.");
  }
  return { status: response.status, body: await response.text() };
}

async function requestBuffer(
  fetchFn: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<{ status: number; body: Uint8Array }> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "GET",
      headers: {
        ...BROWSER_HEADERS,
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new ExportCommentsError("Timed out downloading the ExportComments file.", 504);
    }
    throw new ExportCommentsError("Could not download comments from ExportComments.");
  }
  return { status: response.status, body: new Uint8Array(await response.arrayBuffer()) };
}

function absoluteExportUrl(link: string): string {
  if (/^https?:\/\//i.test(link)) return link;
  if (link.startsWith("/")) return `${EXPORTCOMMENTS_ORIGIN}${link}`;
  return `${EXPORTCOMMENTS_ORIGIN}/${link}`;
}

function optionList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data;
  if (isRecord(payload) && Array.isArray(payload.options)) return payload.options;
  return [];
}

function optionLink(item: Record<string, unknown>): string {
  return asString(item.link).trim();
}

function isUsableFileLink(link: string): boolean {
  if (!link || link.startsWith("#")) return false;
  if (/officeapps\.live\.com|choose-the-winner|\/analytics/i.test(link)) return false;
  if (/filter\[/i.test(link)) return false;
  return true;
}

function csvReadyLink(payload: unknown): string | null {
  for (const item of optionList(payload)) {
    if (!isRecord(item)) continue;
    const link = optionLink(item);
    if (!isUsableFileLink(link)) continue;
    const format = asString(item.format).toLowerCase();
    const looksCsv = format === "csv" || /\.csv(\?|$)/i.test(link);
    if (!looksCsv) continue;
    const status = asString(item.status).toLowerCase();
    if (["idle", "processing", "pending", "convert", "error"].includes(status)) continue;
    if (status && !["done", "ready", "success"].includes(status)) continue;
    if (!status && !/\.csv(\?|$)/i.test(link)) continue;
    return absoluteExportUrl(link);
  }
  return null;
}

function xlsxLinkFromJob(job: Record<string, unknown>, options: unknown): string | null {
  for (const item of optionList(options)) {
    if (!isRecord(item)) continue;
    const link = optionLink(item);
    if (!isUsableFileLink(link)) continue;
    const format = asString(item.format).toLowerCase();
    if (format === "excel" || format === "xlsx" || /\.xlsx(\?|$)/i.test(link)) {
      return absoluteExportUrl(link);
    }
  }
  const downloadUrl = asString(job.download_url).trim();
  if (/\.xlsx(\?|$)/i.test(downloadUrl)) return downloadUrl;
  return null;
}

async function waitForJob(
  fetchFn: typeof fetch,
  guid: string,
  job: Record<string, unknown>,
  deps: {
    sleep: (ms: number) => Promise<void>;
    now: () => number;
    started: number;
    pollIntervalMs: number;
    timeoutMs: number;
    requestTimeoutMs: number;
  },
): Promise<Record<string, unknown>> {
  let current = job;
  while (true) {
    const status = asString(current.status).toLowerCase();
    if (status === "done") return current;
    if (status === "error" || status === "stopped") {
      throw new ExportCommentsError(
        jobErrorMessage(current, "ExportComments could not export this post."),
        502,
      );
    }
    if (deps.now() - deps.started > deps.timeoutMs) {
      throw new ExportCommentsError(
        "Timed out waiting for ExportComments to finish. Try again in a minute.",
        504,
      );
    }
    await deps.sleep(deps.pollIntervalMs);
    const polled = await requestJson(
      fetchFn,
      `${EXPORTCOMMENTS_API_BASE}/job/${guid}`,
      { method: "GET" },
      deps.requestTimeoutMs,
    );
    const next = unwrapJob(polled.body);
    if (!next) {
      throw new ExportCommentsError(
        apiErrorMessage(polled.body, polled.status, "ExportComments status was invalid."),
        polled.status >= 400 ? polled.status : 502,
      );
    }
    current = next;
  }
}

async function commentsFromCsvUrl(
  fetchFn: typeof fetch,
  csvUrl: string,
  timeoutMs: number,
): Promise<GiveawayComment[]> {
  const csvDownload = await requestText(fetchFn, csvUrl, timeoutMs);
  if (csvDownload.status >= 400 || !csvDownload.body.trim()) return [];
  return parseImportedComments(csvDownload.body);
}

async function commentsFromXlsxUrl(
  fetchFn: typeof fetch,
  xlsxUrl: string,
  timeoutMs: number,
): Promise<GiveawayComment[]> {
  const xlsxDownload = await requestBuffer(fetchFn, xlsxUrl, timeoutMs);
  if (xlsxDownload.status >= 400 || !xlsxDownload.body.length) return [];
  return parseXlsxComments(xlsxDownload.body);
}

async function downloadCommentsForJob(
  fetchFn: typeof fetch,
  guid: string,
  sourceUrl: string,
  job: Record<string, unknown>,
  deps: {
    sleep: (ms: number) => Promise<void>;
    pollIntervalMs: number;
    requestTimeoutMs: number;
    timeoutMs: number;
  },
): Promise<ExportedComments> {
  const loadOptions = async () => {
    const options = await requestJson(
      fetchFn,
      `${EXPORTCOMMENTS_API_BASE}/jobs/${guid}/downloadOptions`,
      { method: "GET" },
      deps.requestTimeoutMs,
    );
    return options.body;
  };

  const commentsFromCsv = async (optionsBody: unknown): Promise<GiveawayComment[]> => {
    const csvUrl = csvReadyLink(optionsBody);
    if (!csvUrl) return [];
    return commentsFromCsvUrl(fetchFn, csvUrl, deps.requestTimeoutMs);
  };

  const commentsFromXlsx = async (optionsBody: unknown): Promise<GiveawayComment[]> => {
    const xlsxUrl = xlsxLinkFromJob(job, optionsBody);
    if (!xlsxUrl) return [];
    return commentsFromXlsxUrl(fetchFn, xlsxUrl, deps.requestTimeoutMs);
  };

  let optionsBody = await loadOptions();
  let comments = await commentsFromCsv(optionsBody);
  if (comments.length) {
    return { comments, guid, sourceUrl };
  }

  if (!csvReadyLink(optionsBody)) {
    await requestJson(
      fetchFn,
      `${EXPORTCOMMENTS_API_BASE}/jobs/${guid}/download`,
      { method: "POST", body: JSON.stringify({ format: "csv" }) },
      deps.requestTimeoutMs,
    );
  }

  const csvPolls =
    deps.pollIntervalMs <= 0
      ? 6
      : Math.min(18, Math.max(12, Math.ceil(Math.min(deps.timeoutMs, 90_000) / deps.pollIntervalMs)));
  for (let attempt = 0; attempt < csvPolls && !comments.length; attempt += 1) {
    await deps.sleep(deps.pollIntervalMs);
    optionsBody = await loadOptions();
    comments = await commentsFromCsv(optionsBody);
  }

  if (!comments.length) {
    comments = await commentsFromXlsx(optionsBody);
  }

  if (comments.length) {
    return { comments, guid, sourceUrl };
  }

  const jsonUrl = asString(job.json_url).trim();
  if (jsonUrl) {
    const jsonDownload = await requestJson(
      fetchFn,
      jsonUrl,
      { method: "GET" },
      deps.requestTimeoutMs,
    );
    if (jsonDownload.status < 400) {
      const fromJson = parseExportCommentsJson(jsonDownload.body);
      if (fromJson.length) {
        return { comments: fromJson, guid, sourceUrl };
      }
    }
  }

  const exported = Number(job.total_exported ?? job.total ?? 0);
  if (Number.isFinite(exported) && exported <= 0) {
    throw new ExportCommentsError("ExportComments finished, but this post had no comments.", 502);
  }
  throw new ExportCommentsError("ExportComments finished, but no comments were in the file.", 502);
}

export async function fetchCommentsFromExportComments(
  postUrl: string,
  deps: ExportCommentsDeps = {},
): Promise<ExportedComments> {
  const parsed = parseExportCommentsInput(postUrl);
  if (!parsed) {
    throw new ExportCommentsError(
      "Paste a public Instagram or Facebook post URL, or an exportcomments.com /done/ link.",
      400,
    );
  }

  const fetchFn = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? Date.now;
  const pollIntervalMs = Math.max(0, deps.pollIntervalMs ?? 5_000);
  const timeoutMs = Math.max(1_000, deps.timeoutMs ?? 150_000);
  const requestTimeoutMs = Math.max(1_000, deps.requestTimeoutMs ?? 30_000);
  const started = now();
  const waitDeps = { sleep, now, started, pollIntervalMs, timeoutMs, requestTimeoutMs };
  const downloadDeps = { sleep, pollIntervalMs, requestTimeoutMs, timeoutMs };

  if (parsed.type === "csv") {
    const csvDownload = await requestText(fetchFn, parsed.url, requestTimeoutMs);
    if (csvDownload.status >= 400 || !csvDownload.body.trim()) {
      throw new ExportCommentsError("Could not download that ExportComments CSV.", 502);
    }
    const comments = parseImportedComments(csvDownload.body);
    if (!comments.length) {
      throw new ExportCommentsError("That CSV did not contain comments.", 502);
    }
    const guid = parsed.url.match(GUID_PATTERN)?.[0] ?? "csv";
    return { comments, guid, sourceUrl: parsed.url };
  }

  if (parsed.type === "guid") {
    const polled = await requestJson(
      fetchFn,
      `${EXPORTCOMMENTS_API_BASE}/job/${parsed.guid}`,
      { method: "GET" },
      requestTimeoutMs,
    );
    const job = unwrapJob(polled.body);
    if (!job) {
      throw new ExportCommentsError(
        apiErrorMessage(polled.body, polled.status, "Could not load that ExportComments export."),
        polled.status >= 400 ? polled.status : 502,
      );
    }
    const ready = await waitForJob(fetchFn, parsed.guid, job, waitDeps);
    const sourceUrl = asString(ready.url).trim() || parsed.guid;
    return downloadCommentsForJob(fetchFn, parsed.guid, sourceUrl, ready, downloadDeps);
  }

  const sourceUrl = parsed.url;
  const created = await requestJson(
    fetchFn,
    `${EXPORTCOMMENTS_API_BASE}/job`,
    {
      method: "POST",
      body: JSON.stringify({
        urls: [{ url: sourceUrl }],
      }),
    },
    requestTimeoutMs,
  );

  const guid = extractGuid(created.body);
  const createdError = isRecord(created.body) ? asString(created.body.error) : "";
  if (createdError === "need_captcha") {
    throw new ExportCommentsError(
      apiErrorMessage(created.body, created.status, "ExportComments could not start the export."),
      403,
      "need_captcha",
      exportCommentsStartUrl(sourceUrl),
    );
  }
  if (!guid) {
    throw new ExportCommentsError(
      apiErrorMessage(created.body, created.status, "ExportComments could not start the export."),
      created.status >= 400 ? created.status : 502,
      createdError || undefined,
      createdError === "need_captcha" ? exportCommentsStartUrl(sourceUrl) : undefined,
    );
  }
  if (created.status >= 400 && createdError && createdError !== "export.unfinished") {
    throw new ExportCommentsError(
      apiErrorMessage(created.body, created.status, "ExportComments could not start the export."),
      created.status,
      createdError,
      createdError === "need_captcha" ? exportCommentsStartUrl(sourceUrl) : undefined,
    );
  }

  const initial = unwrapJob(created.body) ?? { guid, status: "queueing" };
  const ready = await waitForJob(fetchFn, guid, initial, waitDeps);
  return downloadCommentsForJob(fetchFn, guid, sourceUrl, ready, downloadDeps);
}
