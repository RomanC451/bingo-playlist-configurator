import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/api-auth";
import { isAllowedAvatarUrl } from "@/lib/avatars";
import { prisma } from "@/lib/db";

const updateProfileSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    image: z.string().url().optional(),
    currentPassword: z.string().min(8).optional(),
    newPassword: z.string().min(8).max(128).optional(),
  })
  .refine(
    (data) => !data.newPassword || data.currentPassword,
    { message: "Current password is required to set a new password", path: ["currentPassword"] },
  )
  .refine((data) => !data.image || isAllowedAvatarUrl(data.image), {
    message: "Invalid avatar selection",
    path: ["image"],
  });

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session!.user!.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      passwordHash: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt,
  });
}

export async function PATCH(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = session!.user!.id;
  const body = await request.json();
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { name, email, image, currentPassword, newPassword } = parsed.data;

  if (email && email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  if (newPassword) {
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Password sign-in is not enabled for this account" },
        { status: 400 },
      );
    }

    const valid = await bcrypt.compare(currentPassword!, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(image !== undefined ? { image } : {}),
      ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 12) } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      passwordHash: true,
    },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    image: updated.image,
    hasPassword: Boolean(updated.passwordHash),
  });
}
