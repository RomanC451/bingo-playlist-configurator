import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getAudioStream, isS3AudioConfigError } from "@/lib/s3-audio";

export async function streamUploadedAudioResponse(
  key: string,
  request: Request,
): Promise<Response> {
  try {
    const rangeHeader = request.headers.get("range");
    const stream = await getAudioStream(key, rangeHeader);
    const headers = new Headers();
    headers.set("Content-Type", stream.contentType);
    headers.set("Accept-Ranges", stream.acceptRanges);
    headers.set("Cache-Control", "private, max-age=3600");
    if (stream.contentLength != null) {
      headers.set("Content-Length", String(stream.contentLength));
    }
    if (stream.contentRange) {
      headers.set("Content-Range", stream.contentRange);
    }

    const body =
      typeof stream.body.transformToWebStream === "function"
        ? stream.body.transformToWebStream()
        : Readable.toWeb(stream.body as Readable);

    return new Response(body as BodyInit, {
      status: stream.statusCode,
      headers,
    });
  } catch (err) {
    if (isS3AudioConfigError(err)) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
}
