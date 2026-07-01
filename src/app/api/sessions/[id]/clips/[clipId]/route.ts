import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";

type RouteContext = { params: Promise<{ id: string; clipId: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id, clipId } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAccess(id, userId);
    return NextResponse.json(
      { error: "Use PUT /api/sessions/[id]/tracks/[clipId]/proposal to save a clip version" },
      { status: 410 },
    );
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
