import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { isAllowedGiveawayImageUrl } from "@/lib/giveaway/avatar";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const url = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!isAllowedGiveawayImageUrl(url)) {
    return NextResponse.json({ error: "Unsupported image URL" }, { status: 400 });
  }

  const upstream = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      Referer: "https://www.instagram.com/",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    cache: "force-cache",
    redirect: "follow",
  });
  if (!upstream.ok) {
    return new NextResponse(null, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return new NextResponse(null, { status: 502 });
  }

  const bytes = await upstream.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
