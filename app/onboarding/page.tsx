import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBankrolls } from "@/app/actions/bankroll-actions";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { settings: true },
  });

  const settings =
    user?.settings && typeof user.settings === "object" ? user.settings : null;
  const hasCompleted = settings
    ? Boolean((settings as { onboardingCompleted?: boolean }).onboardingCompleted)
    : false;

  if (hasCompleted) {
    redirect("/");
  }

  const bankrolls = await getBankrolls();

  return <OnboardingWizard initialBankrolls={bankrolls} />;
}
