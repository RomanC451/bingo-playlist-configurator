import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import {
  clearPersistedActiveTeam,
  persistActiveTeamForUser,
} from "@/lib/active-team";
import { requireTeamMember, TeamAccessError } from "@/lib/team-auth";

const setActiveSchema = z.object({
  teamId: z.string(),
});

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const body = await request.json();
  const parsed = setActiveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    await requireTeamMember(parsed.data.teamId, session!.user!.id);

    const response = NextResponse.json({ activeTeamId: parsed.data.teamId });
    await persistActiveTeamForUser(session!.user!.id, parsed.data.teamId, response);
    return response;
  } catch (err) {
    if (err instanceof TeamAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const response = NextResponse.json({ activeTeamId: null });
  await clearPersistedActiveTeam(session!.user!.id, response);
  return response;
}
