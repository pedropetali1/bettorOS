import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getBankrolls } from "@/app/actions/bankroll-actions";
import { OperationForm } from "@/components/operation-form";

export default async function NewOperationPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const bankrolls = await getBankrolls();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">New Operation</h1>
        <p className="text-sm text-muted-foreground">
          Create simple bets, multi-leg parlays, or arbitrary operations with dynamic legs.
        </p>
      </div>
      <OperationForm bankrolls={bankrolls} />
    </div>
  );
}
