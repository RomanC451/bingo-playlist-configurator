import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Unauthorized", source: "internal" as const },
        { status: 401 },
      ),
    };
  }
  return { session, error: null };
}
