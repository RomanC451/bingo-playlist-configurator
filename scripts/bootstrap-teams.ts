import "dotenv/config";
import { prisma } from "../src/lib/db";
import { ensurePersonalTeam } from "../src/lib/team-bootstrap";

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });

  for (const user of users) {
    const teamId = await ensurePersonalTeam(user.id);
    console.log(`Bootstrapped team ${teamId} for ${user.email}`);
  }

  const orphanCount = await prisma.bingoSession.count({ where: { teamId: null } });
  if (orphanCount > 0) {
    console.warn(`Warning: ${orphanCount} sessions still have no teamId`);
  } else {
    console.log("All sessions assigned to teams.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
