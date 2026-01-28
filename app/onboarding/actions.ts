"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type ActionResult = { ok: boolean; message: string };

export async function completeOnboarding(): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false, message: "Unauthorized." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { settings: true },
    });
    const settings =
      user?.settings && typeof user.settings === "object" ? user.settings : null;

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        settings: {
          ...(settings && typeof settings === "object" ? settings : {}),
          onboardingCompleted: true,
        },
      },
    });

    return { ok: true, message: "Tudo pronto para começar a usar o BettorOS." };
  } catch (error) {
    return { ok: false, message: "Não foi possível concluir o onboarding." };
  }
}
