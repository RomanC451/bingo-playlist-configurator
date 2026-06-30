import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { recordSessionWork } from "@/lib/session-activity";
import { apiErrorResponse, teamAccessResponse } from "@/lib/team-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await context.params;
  const userId = session!.user!.id;

  try {
    await recordSessionWork(userId, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    return apiErrorResponse(err, "Failed to record session activity");
  }
}
