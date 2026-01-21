import Link from "next/link";
import { format } from "date-fns";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOperations } from "@/app/actions/operation-actions";
import { BetActions } from "@/components/bet-actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
          {operations.map((operation) => {
            const stake = Number(operation.totalStake);
            const expected = Number(operation.expectedReturn ?? 0);
            const actual = Number(operation.actualReturn ?? 0);

            return (
              <div key={operation.id} className="rounded-lg border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      {operation.type} • {operation.status}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Created {format(new Date(operation.createdAt), "yyyy-MM-dd")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Stake</p>
                      <p className="font-medium">{stake.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Expected</p>
                      <p className="font-medium">{expected.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Actual</p>
                      <p className="font-medium">{actual.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Selection</TableHead>
                        <TableHead>Bookmaker</TableHead>
                        <TableHead>Odds</TableHead>
                        <TableHead>Stake</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operation.legs.map((leg) => (
                        <TableRow key={leg.id}>
                          <TableCell className="font-medium">
                            {leg.selection}
                          </TableCell>
                          <TableCell>{leg.bankrollName}</TableCell>
                          <TableCell>{Number(leg.odds).toFixed(2)}</TableCell>
                          <TableCell>{Number(leg.stake).toFixed(2)}</TableCell>
                          <TableCell>{leg.status}</TableCell>
                          <TableCell>
                            {leg.resultValue
                              ? Number(leg.resultValue).toFixed(2)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <BetActions
                              betId={leg.id}
                              stake={leg.stake}
                              odds={leg.odds}
                              status={leg.status}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
