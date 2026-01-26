import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getBankrolls } from "@/app/actions/bankroll-actions";
import { ArbitrageCalculator } from "@/components/arbitrage-calculator";

export default async function ArbitrageToolPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const bankrolls = await getBankrolls();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Surebet Calculator</h1>
        <p className="text-sm text-muted-foreground">
          Split stakes across multiple books and submit as an arbitrage operation.
        </p>
      </div>
      <ArbitrageCalculator bankrolls={bankrolls} />
    </div>
  );
}
