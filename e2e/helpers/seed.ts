import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import { ensurePersonalTeam } from "../../src/lib/team-bootstrap";

export const E2E_USER = {
  name: "E2E Test User",
  email: "e2e@test.local",
  password: "testpassword123",
};

export async function seedE2eUser() {
  const passwordHash = await bcrypt.hash(E2E_USER.password, 12);

  const user = await prisma.user.upsert({
    where: { email: E2E_USER.email },
    create: {
      name: E2E_USER.name,
      email: E2E_USER.email,
      passwordHash,
    },
    update: {
      name: E2E_USER.name,
      passwordHash,
    },
  });

  await ensurePersonalTeam(user.id);
}

export async function cleanupE2eUser() {
  await prisma.user.deleteMany({
    where: { email: E2E_USER.email },
  });
}
