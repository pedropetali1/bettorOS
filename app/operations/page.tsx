import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";

import { auth } from "@/auth";
import { getOperations } from "@/app/actions/operation-actions";
import { getBankrolls } from "@/app/actions/bankroll-actions";
import { OperationCard } from "@/components/operations/operation-card";
import { Button } from "@/components/ui/button";

export default async function OperationsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [operations, bankrolls] = await Promise.all([getOperations(), getBankrolls()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Operations</h1>
          <p className="text-sm text-muted-foreground">
            Review simple bets and arbitrage operations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/operations/new">New Operation</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/api/export/operations">
              <Download className="size-4" />
              Export CSV
            </Link>
          </Button>
        </div>
      </div>
      {operations.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No operations yet. Start onboarding to record your first operation.{" "}
          <Link href="/onboarding" className="text-primary underline">
            Go to onboarding
          </Link>
          .
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {operations.map((operation) => (
            <OperationCard key={operation.id} operation={operation} bankrolls={bankrolls} />
          ))}
        </div>
      )}
    </div>
  );
}
