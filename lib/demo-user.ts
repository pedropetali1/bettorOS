import { prisma } from "@/lib/prisma";

const DEMO_EMAIL = "demo@bettoros.local";

export async function getOrCreateDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: "Demo User",
    },
  });
}
