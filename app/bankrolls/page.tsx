import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getBankrolls } from "@/app/actions/bankroll-actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function BankrollsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const bankrolls = await getBankrolls();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bankrolls</h1>
          <p className="text-sm text-muted-foreground">
            Track balances across your bookmakers.
          </p>
        </div>
        <Button asChild>
          <Link href="/bankrolls/new">New Bankroll</Link>
        </Button>
      </div>
      {bankrolls.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No bankrolls yet. Add your first bankroll to get started.
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bookmaker</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bankrolls.map((bankroll) => {
                const balance = Number(bankroll.currentBalance);
                const formatted = new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: bankroll.currency,
                }).format(Number.isNaN(balance) ? 0 : balance);

                return (
                  <TableRow key={bankroll.id}>
                    <TableCell className="font-medium">
                      {bankroll.bookmakerName}
                    </TableCell>
                    <TableCell>{bankroll.currency}</TableCell>
                    <TableCell className="text-right">{formatted}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
