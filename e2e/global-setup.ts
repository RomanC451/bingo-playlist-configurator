import { seedE2eUser } from "./helpers/seed";

export default async function globalSetup() {
  await seedE2eUser();
}
