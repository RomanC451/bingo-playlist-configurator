import { prisma } from "@/lib/db";

export async function clearTrackClipReviews(trackClipId: string) {
  await prisma.trackClipReview.deleteMany({ where: { trackClipId } });
}
