import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { generateReviewShareToken } from "@/lib/guest-review";
import { prisma } from "@/lib/db";
import {
  isTeamManager,
  requireSessionAccess,
  requireSessionAdmin,
  teamAccessResponse,
} from "@/lib/team-auth";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  rotateToken: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: sessionId } = await context.params;
  const userId = session!.user!.id;

  try {
    const { bingoSession, membership } = await requireSessionAccess(sessionId, userId);
    const canManage =
      !bingoSession.teamId || (membership != null && isTeamManager(membership.role));

    const share = await prisma.bingoSession.findUnique({
      where: { id: sessionId },
      select: { reviewShareEnabled: true, reviewShareToken: true },
    });

    return NextResponse.json({
      reviewShareEnabled: share?.reviewShareEnabled ?? false,
      reviewShareToken: share?.reviewShareToken ?? null,
      canManage,
    });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: sessionId } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAdmin(sessionId, userId);

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const current = await prisma.bingoSession.findUnique({
      where: { id: sessionId },
      select: { reviewShareEnabled: true, reviewShareToken: true },
    });

    if (!current) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    let reviewShareEnabled = current.reviewShareEnabled;
    let reviewShareToken = current.reviewShareToken;

    if (parsed.data.enabled !== undefined) {
      reviewShareEnabled = parsed.data.enabled;
      if (reviewShareEnabled && !reviewShareToken) {
        reviewShareToken = generateReviewShareToken();
      }
    }

    if (parsed.data.rotateToken) {
      reviewShareToken = generateReviewShareToken();
      reviewShareEnabled = true;
    }

    const updated = await prisma.bingoSession.update({
      where: { id: sessionId },
      data: { reviewShareEnabled, reviewShareToken },
      select: {
        reviewShareEnabled: true,
        reviewShareToken: true,
      },
    });

    return NextResponse.json({
      reviewShareEnabled: updated.reviewShareEnabled,
      reviewShareToken: updated.reviewShareToken,
    });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
