import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedGiveawayImageUrl } from "./giveaway/avatar.ts";
import {
  buildReelStrip,
  buildSpotlightSequence,
  buildRaceCast,
  reelLandingIndex,
  reelOffsetPx,
  sequenceAtProgress,
  raceLaneProgress,
} from "./giveaway/draw-animations.ts";
import { eligibleEntries, normalizeHandle, pickOrderedWinners, pickWinner } from "./giveaway/entries.ts";
import {
  EXPORTCOMMENTS_API_BASE,
  fetchCommentsFromExportComments,
  parseExportCommentsInput,
  normalizePostUrl,
} from "./giveaway/export-comments.ts";
import {
  mergeImportedComments,
  parseExportCommentsJson,
  parseImportedComments,
} from "./giveaway/parse-import.ts";
import { parseXlsxComments } from "./giveaway/parse-xlsx.ts";
import type { GiveawayComment, GiveawayFilters } from "./giveaway/types.ts";

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, contents] of Object.entries(files)) {
    const data = encoder.encode(contents);
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);
    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, centrals.length, true);
  eocdView.setUint16(10, centrals.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + eocd.length);
  let cursor = 0;
  for (const part of locals) {
    out.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centrals) {
    out.set(part, cursor);
    cursor += part.length;
  }
  out.set(eocd, cursor);
  return out;
}

function exportCommentsXlsx(): Uint8Array {
  const sst = [
    "Exported by",
    "ExportComments.com",
    "Name",
    "Username",
    "Comment",
    "ada",
    "tag @bea",
  ];
  return zipStore({
    "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8"?><sst uniqueCount="${sst.length}">${sst
      .map((value) => `<si><t>${value}</t></si>`)
      .join("")}</sst>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="7"><c r="C7" t="s"><v>2</v></c><c r="D7" t="s"><v>3</v></c><c r="H7" t="s"><v>4</v></c></row><row r="8"><c r="C8" t="s"><v>5</v></c><c r="D8" t="s"><v>5</v></c><c r="G8" s="6"/><c r="H8" t="s"><v>6</v></c></row></sheetData></worksheet>`,
  });
}

function comment(
  username: string,
  options: Partial<GiveawayComment> = {},
): GiveawayComment {
  return {
    id: options.id ?? username,
    username,
    displayName: options.displayName ?? username,
    text: options.text ?? "hello",
    createdAt: options.createdAt ?? null,
    isReply: options.isReply ?? false,
    thumbnailUrl: options.thumbnailUrl ?? null,
  };
}

const baseFilters: GiveawayFilters = {
  uniqueUsers: false,
  requireTag: false,
};

describe("giveaway import", () => {
  it("parses @user: text lines", () => {
    const comments = parseImportedComments("@alice: I want this\nbob Nice clip");
    assert.equal(comments.length, 2);
    assert.equal(comments[0]?.username, "alice");
    assert.equal(comments[0]?.text, "I want this");
    assert.equal(comments[1]?.username, "bob");
  });

  it("parses CSV with reply flags", () => {
    const comments = parseImportedComments(
      "username,text,isReply\n@Ada,First,false\nBea,Reply,true",
    );
    assert.equal(comments.length, 2);
    assert.equal(comments[0]?.username, "Ada");
    assert.equal(comments[1]?.isReply, true);
  });

  it("parses Instagram comment export CSV", () => {
    const raw = [
      ',,Name,Username,"Profile ID",Date,Likes,Comment,"User Verified",Thumbnail,"Comment ID","Profile URL","Comment URL"',
      '1,,reflexo_masaj,reflexo_masaj,1,"2026-09-17 06:45:20",0,"Un eveniment super fain, nu doar distractiv",no,https://scontent.cdninstagram.com/v/t51.2885-19/photo.jpg,18122131154483849,https://www.instagram.com/reflexo_masaj,https://www.instagram.com/p/DdYB7CLsQ2P/c/18122131154483849',
      "2,,fundatiacote,fundatiacote,2,\"2026-09-18 08:18:55\",0,Mulțumim tuturor!,no,,18338345050280363,https://www.instagram.com/fundatiacote,https://www.instagram.com/p/DdYB7CLsQ2P/c/18338345050280363",
    ].join("\n");
    const comments = parseImportedComments(raw);
    assert.equal(comments.length, 2);
    assert.equal(comments[0]?.username, "reflexo_masaj");
    assert.match(comments[0]?.text ?? "", /eveniment super fain/);
    assert.equal(comments[0]?.id, "18122131154483849");
    assert.equal(
      comments[0]?.thumbnailUrl,
      "https://scontent.cdninstagram.com/v/t51.2885-19/photo.jpg",
    );
    assert.equal(comments[1]?.username, "fundatiacote");
  });

  it("finds Username/Comment headers below ExportComments banner rows", () => {
    const comments = parseImportedComments(
      [
        "Exported by,ExportComments.com",
        "Source URL,https://www.instagram.com/p/DdYB7CLsQ2P/",
        "",
        ",,Name,Username,Comment",
        "1,,ada,ada,tag @bea",
      ].join("\n"),
    );
    assert.equal(comments.length, 1);
    assert.equal(comments[0]?.username, "ada");
    assert.match(comments[0]?.text ?? "", /tag @bea/);
  });

  it("merges extra CSV rows without duplicating comment ids", () => {
    const first = parseImportedComments("Username,Comment,\"Comment ID\"\nada,hi,1\n");
    const second = parseImportedComments("Username,Comment,\"Comment ID\"\nbea,yo,2\nada,hi,1\n");
    const merged = mergeImportedComments(first, second);
    assert.equal(merged.length, 2);
    assert.deepEqual(
      merged.map((row) => row.username).sort(),
      ["ada", "bea"],
    );
  });

  it("parses ExportComments xlsx worksheets with banner rows", () => {
    const comments = parseXlsxComments(exportCommentsXlsx());
    assert.equal(comments.length, 1);
    assert.equal(comments[0]?.username, "ada");
    assert.match(comments[0]?.text ?? "", /tag @bea/);
  });

  it("allows Instagram CDN thumbs and rejects local URLs", () => {
    assert.equal(
      isAllowedGiveawayImageUrl("https://scontent-mxp1-1.cdninstagram.com/v/t51.2885-19/photo.jpg"),
      true,
    );
    assert.equal(isAllowedGiveawayImageUrl("http://127.0.0.1/secret"), false);
    assert.equal(isAllowedGiveawayImageUrl("https://example.com/photo.jpg"), false);
  });
});

describe("giveaway entries", () => {
  const comments = [
    comment("Host", { text: "rules" }),
    comment("Ada", { text: "one" }),
    comment("ada", { text: "two" }),
    comment("Bea", { isReply: true, text: "reply" }),
  ];

  it("keeps one entry per comment by default", () => {
    assert.equal(eligibleEntries(comments, baseFilters).length, 4);
  });

  it("dedupes users case-insensitively", () => {
    const entries = eligibleEntries(comments, { ...baseFilters, uniqueUsers: true });
    assert.deepEqual(
      entries.map((entry) => entry.username),
      ["Host", "Ada", "Bea"],
    );
  });

  it("requires an @tag in the comment when enabled", () => {
    const tagged = [
      comment("Ada", { text: "count me in" }),
      comment("Bea", { text: "@friend let's go" }),
      comment("Cara", { text: "email@example.com is not a tag" }),
    ];
    const entries = eligibleEntries(tagged, { ...baseFilters, requireTag: true });
    assert.deepEqual(
      entries.map((entry) => entry.username),
      ["Bea"],
    );
  });

  it("picks with an injected RNG", () => {
    const entries = [comment("Ada"), comment("Bea")];
    assert.equal(pickWinner(entries, () => 1).username, "Bea");
  });

  it("picks backup winners without repeating", () => {
    const entries = [comment("Ada"), comment("Bea"), comment("Cara")];
    const [winner, ...backups] = pickOrderedWinners(entries, 3, () => 0);
    assert.equal(winner?.username, "Ada");
    assert.deepEqual(
      backups.map((entry) => entry.username),
      ["Bea", "Cara"],
    );
  });

  it("never uses the same person as winner and backup", () => {
    const entries = [
      comment("Ada", { id: "a1" }),
      comment("ada", { id: "a2" }),
      comment("Bea", { id: "b1" }),
      comment("Cara", { id: "c1" }),
    ];
    const [winner, ...backups] = pickOrderedWinners(
      entries,
      3,
      () => 0,
      (entry) => normalizeHandle(entry.username),
    );
    assert.equal(winner?.id, "a1");
    assert.deepEqual(
      backups.map((entry) => entry.username),
      ["Bea", "Cara"],
    );
  });
});

describe("giveaway draw animations", () => {
  it("puts the race winner on the finish line first", () => {
    assert.equal(raceLaneProgress(1, 2, 2), 1);
    assert.ok(raceLaneProgress(1, 0, 2) < 1);
    assert.ok(raceLaneProgress(1, 1, 2) < 1);
  });

  it("lands the reel winner in the middle, with names after it", () => {
    const pool = [comment("Ada"), comment("Bea"), comment("Cara")];
    const winner = pool[1]!;
    const strip = buildReelStrip(pool, winner, 10, () => 0);
    const landing = reelLandingIndex(strip.length);
    assert.equal(strip[landing]?.username, "Bea");
    assert.notEqual(strip.at(-1)?.username, "Bea");
    assert.ok(landing < strip.length - 1);
    assert.equal(reelOffsetPx(landing, 88), (landing - 1) * 88);
  });

  it("keeps the winner on a sampled race", () => {
    const pool = Array.from({ length: 20 }, (_, i) => comment(`u${i}`));
    const winner = pool[7]!;
    const cast = buildRaceCast(pool, winner, 6, () => 0);
    assert.equal(cast.length, 6);
    assert.ok(cast.some((entry) => entry.id === winner.id));
  });

  it("ends the spotlight sequence on the winner index", () => {
    const sequence = buildSpotlightSequence(5, 2, 8, () => 0);
    assert.equal(sequence.at(-1), 2);
    assert.equal(sequenceAtProgress(1, sequence), 2);
  });
});

describe("giveaway ExportComments", () => {
  it("normalizes Instagram and Facebook post URLs", () => {
    assert.equal(
      normalizePostUrl("https://www.instagram.com/p/DdYB7CLsQ2P/?igsh=abc"),
      "https://www.instagram.com/p/DdYB7CLsQ2P/",
    );
    assert.equal(normalizePostUrl("https://facebook.com/share/p/xyz"), "https://facebook.com/share/p/xyz");
    assert.equal(normalizePostUrl("https://example.com/p/nope"), null);
  });

  it("reads a finished export from a /done/ link", () => {
    const parsed = parseExportCommentsInput(
      "https://exportcomments.com/done/efd603d4-10a6-4056-83dc-0be3a889c376",
    );
    assert.deepEqual(parsed, {
      type: "guid",
      guid: "efd603d4-10a6-4056-83dc-0be3a889c376",
    });
  });

  it("parses ExportComments JSON rows", () => {
    const comments = parseExportCommentsJson({
      data: [
        {
          Username: "ada",
          Comment: "hi @bea",
          Thumbnail: "https://scontent.cdninstagram.com/v/photo.jpg",
          "Comment ID": "99",
        },
      ],
    });
    assert.equal(comments.length, 1);
    assert.equal(comments[0]?.username, "ada");
    assert.equal(comments[0]?.id, "99");
  });

  it("creates a job, polls, and imports the CSV", async () => {
    let polls = 0;
    const fetchMock: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url === `${EXPORTCOMMENTS_API_BASE}/job` && init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as { urls?: { url: string }[] };
        assert.equal(payload.urls?.[0]?.url, "https://www.instagram.com/p/DdYB7CLsQ2P/");
        return Response.json({ guid: "job-1", status: "queueing" }, { status: 201 });
      }
      if (url === `${EXPORTCOMMENTS_API_BASE}/job/job-1`) {
        polls += 1;
        return Response.json({
          guid: "job-1",
          status: polls >= 2 ? "done" : "progress",
        });
      }
      if (url === `${EXPORTCOMMENTS_API_BASE}/jobs/job-1/downloadOptions`) {
        return Response.json([
          {
            format: "csv",
            status: "done",
            link: "/exports/export_job-1.csv",
          },
        ]);
      }
      if (url === "https://exportcomments.com/exports/export_job-1.csv") {
        return new Response("Username,Comment\nada,tag @bea\n");
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const result = await fetchCommentsFromExportComments(
      "https://www.instagram.com/p/DdYB7CLsQ2P/?igsh=x",
      {
        fetch: fetchMock,
        pollIntervalMs: 0,
        timeoutMs: 5_000,
        sleep: async () => undefined,
      },
    );
    assert.equal(result.guid, "job-1");
    assert.equal(result.comments[0]?.username, "ada");
    assert.match(result.comments[0]?.text ?? "", /tag @bea/);
  });

  it("imports comments from a finished ExportComments guid", async () => {
    const fetchMock: typeof fetch = async (input) => {
      const url = String(input);
      if (url === `${EXPORTCOMMENTS_API_BASE}/job/efd603d4-10a6-4056-83dc-0be3a889c376`) {
        return Response.json({
          guid: "efd603d4-10a6-4056-83dc-0be3a889c376",
          status: "done",
          url: "https://www.instagram.com/p/DdYB7CLsQ2P/",
        });
      }
      if (
        url ===
        `${EXPORTCOMMENTS_API_BASE}/jobs/efd603d4-10a6-4056-83dc-0be3a889c376/downloadOptions`
      ) {
        return Response.json([
          {
            format: "csv",
            status: "done",
            link: "/exports/export_done.csv",
          },
        ]);
      }
      if (url === "https://exportcomments.com/exports/export_done.csv") {
        return new Response("Username,Comment\nada,tag @bea\n");
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const result = await fetchCommentsFromExportComments(
      "https://exportcomments.com/done/efd603d4-10a6-4056-83dc-0be3a889c376",
      { fetch: fetchMock, pollIntervalMs: 0, timeoutMs: 5_000, sleep: async () => undefined },
    );
    assert.equal(result.guid, "efd603d4-10a6-4056-83dc-0be3a889c376");
    assert.equal(result.comments[0]?.username, "ada");
  });

  it("imports comments from the xlsx when CSV is not ready", async () => {
    const workbook = exportCommentsXlsx();
    const guid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const fetchMock: typeof fetch = async (input) => {
      const url = String(input);
      if (url === `${EXPORTCOMMENTS_API_BASE}/job/${guid}`) {
        return Response.json({
          guid,
          status: "done",
          url: "https://www.instagram.com/p/DdYB7CLsQ2P/",
          download_url: "https://exportcomments.com/exports/ig-comments.xlsx",
          total_exported: 1,
        });
      }
      if (url === `${EXPORTCOMMENTS_API_BASE}/jobs/${guid}/download`) {
        return Response.json({ message: "OK" });
      }
      if (url === `${EXPORTCOMMENTS_API_BASE}/jobs/${guid}/downloadOptions`) {
        return Response.json([
          {
            format: "excel",
            link: "https://exportcomments.com/exports/ig-comments.xlsx",
          },
        ]);
      }
      if (url === "https://exportcomments.com/exports/ig-comments.xlsx") {
        return new Response(workbook);
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const result = await fetchCommentsFromExportComments(`https://exportcomments.com/done/${guid}`, {
      fetch: fetchMock,
      pollIntervalMs: 0,
      timeoutMs: 5_000,
      sleep: async () => undefined,
    });
    assert.equal(result.comments[0]?.username, "ada");
  });

  it("prefers the CSV so profile thumbnails are kept", async () => {
    const workbook = exportCommentsXlsx();
    const guid = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
    let csvReady = false;
    const fetchMock: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url === `${EXPORTCOMMENTS_API_BASE}/job/${guid}`) {
        return Response.json({
          guid,
          status: "done",
          url: "https://www.instagram.com/p/DdYB7CLsQ2P/",
          download_url: "https://exportcomments.com/exports/ig-comments.xlsx",
          total_exported: 1,
        });
      }
      if (url === `${EXPORTCOMMENTS_API_BASE}/jobs/${guid}/download` && init?.method === "POST") {
        csvReady = true;
        return Response.json({ message: "OK" });
      }
      if (url === `${EXPORTCOMMENTS_API_BASE}/jobs/${guid}/downloadOptions`) {
        return Response.json(
          csvReady
            ? [
                {
                  format: "csv",
                  status: "done",
                  link: "/exports/export_thumbs.csv",
                },
                {
                  format: "excel",
                  link: "https://exportcomments.com/exports/ig-comments.xlsx",
                },
              ]
            : [
                {
                  format: "csv",
                  status: "idle",
                  link: "/exports/pending.csv",
                },
                {
                  format: "excel",
                  link: "https://exportcomments.com/exports/ig-comments.xlsx",
                },
              ],
        );
      }
      if (url === "https://exportcomments.com/exports/pending.csv") {
        throw new Error("used idle csv before it was ready");
      }
      if (url === "https://exportcomments.com/exports/export_thumbs.csv") {
        return new Response(
          "Username,Comment,Thumbnail\nada,tag @bea,https://scontent.cdninstagram.com/v/t51.2885-19/photo.jpg\n",
        );
      }
      if (url === "https://exportcomments.com/exports/ig-comments.xlsx") {
        return new Response(workbook);
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const result = await fetchCommentsFromExportComments(`https://exportcomments.com/done/${guid}`, {
      fetch: fetchMock,
      pollIntervalMs: 0,
      timeoutMs: 5_000,
      sleep: async () => undefined,
    });
    assert.equal(result.comments[0]?.username, "ada");
    assert.equal(
      result.comments[0]?.thumbnailUrl,
      "https://scontent.cdninstagram.com/v/t51.2885-19/photo.jpg",
    );
  });
});
