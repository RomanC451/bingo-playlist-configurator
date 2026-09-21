import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError } from "@/lib/api-errors";
import {
  ExportCommentsError,
  fetchCommentsFromExportComments,
} from "@/lib/giveaway/export-comments";

export const runtime = "nodejs";
export const maxDuration = 180;

const bodySchema = z.object({
  url: z.string().min(1),
});

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste an Instagram or Facebook post URL." }, { status: 400 });
  }

  try {
    const result = await fetchCommentsFromExportComments(parsed.data.url);
    return NextResponse.json({
      comments: result.comments,
      guid: result.guid,
      sourceUrl: result.sourceUrl,
      count: result.comments.length,
    });
  } catch (err) {
    if (err instanceof ExportCommentsError) {
      return NextResponse.json(
        { error: err.message, code: err.code, startUrl: err.startUrl },
        { status: err.status },
      );
    }
    return internalError("Could not export comments.");
  }
}
