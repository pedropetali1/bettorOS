import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signOutAction } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [bankrolls, operationsCount] = await Promise.all([
    prisma.bankroll.findMany({
      where: { userId: session.user.id },
      orderBy: { bookmakerName: "asc" },
    }),
    prisma.operation.count({ where: { userId: session.user.id } }),
  ]);

  const totalBalance = bankrolls.reduce(
    (acc, bankroll) => acc + Number(bankroll.currentBalance),
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, bankrolls, and sign out.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Name</p>
              <p>{session.user.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Email</p>
              <p>{session.user.email ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Totals tied to this account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Bankrolls</p>
              <p>{bankrolls.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Operations</p>
              <p>{operationsCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Total Balance</p>
              <p>
                {formatCurrency(totalBalance, bankrolls[0]?.currency ?? "BRL")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>Log out of BettorOS.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signOutAction}>
              <Button type="submit" variant="destructive" className="w-full">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bankrolls</CardTitle>
          <CardDescription>Linked accounts and balances.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {bankrolls.length ? (
            bankrolls.map((bankroll) => (
              <div key={bankroll.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{bankroll.bookmakerName}</p>
                  <p className="text-xs text-muted-foreground">{bankroll.currency}</p>
                </div>
                <span>
                  {formatCurrency(
                    Number(bankroll.currentBalance),
                    bankroll.currency
                  )}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              No bankrolls yet. Create one to start tracking balances.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
