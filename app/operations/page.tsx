import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOperations } from "@/app/actions/operation-actions";
import { OperationCard } from "@/components/operations/operation-card";
import { Button } from "@/components/ui/button";

export default async function OperationsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const operations = await getOperations();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Operations</h1>
          <p className="text-sm text-muted-foreground">
            Review simple bets and arbitrage operations.
          </p>
        </div>
        <Button asChild>
          <Link href="/operations/new">New Operation</Link>
        </Button>
      </div>
      {operations.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No operations yet. Record your first bet to get started.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {operations.map((operation) => (
            <OperationCard key={operation.id} operation={operation} />
          ))}
        </div>
      )}
    </div>
  );
}
