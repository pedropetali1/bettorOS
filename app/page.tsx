import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Download } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

const colors = ["#6366f1", "#10b981", "#f97316", "#ec4899", "#14b8a6"];

type DashboardPeriod = "7d" | "30d" | "90d" | "all";

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "All" },
];

const resolvePeriodStart = (value: string | undefined) => {
  const period = (periodOptions.find((option) => option.value === value)?.value ??
    "all") as DashboardPeriod;
  if (period === "all") return { period, dateFrom: null };
  const days = Number(period.replace("d", ""));
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);
  dateFrom.setHours(0, 0, 0, 0);
  return { period, dateFrom };
};

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const onboarding = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { settings: true },
  });

  const settings =
    onboarding?.settings && typeof onboarding.settings === "object"
      ? onboarding.settings
      : null;
  const hasCompleted = settings
    ? Boolean((settings as { onboardingCompleted?: boolean }).onboardingCompleted)
    : false;

  if (!hasCompleted) {
    redirect("/onboarding");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { period, dateFrom } = resolvePeriodStart(resolvedSearchParams?.period);

  const bankrolls = await prisma.bankroll.findMany({
    where: { userId: session.user.id },
    select: { id: true, currentBalance: true, currency: true, bookmakerName: true },
  });

  const totalBalance = bankrolls.reduce(
    (acc, bankroll) => acc.add(bankroll.currentBalance),
    new Prisma.Decimal(0)
  );

  const activeOperations = await prisma.operation.count({
    where: {
      userId: session.user.id,
      status: "PENDING",
      ...(dateFrom ? { createdAt: { gte: dateFrom } } : {}),
    },
  });

  const settledOperations = await prisma.operation.findMany({
    where: {
      userId: session.user.id,
      actualReturn: { not: null },
      ...(dateFrom ? { createdAt: { gte: dateFrom } } : {}),
    },
    select: { totalStake: true, actualReturn: true },
  });

  const totals = settledOperations.reduce(
    (acc, operation) => {
      const actual = operation.actualReturn ?? new Prisma.Decimal(0);
      return {
        stake: acc.stake.add(operation.totalStake),
        actual: acc.actual.add(actual),
      };
    },
    { stake: new Prisma.Decimal(0), actual: new Prisma.Decimal(0) }
  );

  const roi =
    totals.stake.gt(0)
      ? totals.actual.sub(totals.stake).div(totals.stake).mul(100)
      : new Prisma.Decimal(0);

  const betBreakdown = await prisma.bet.findMany({
    where: {
      operation: {
        userId: session.user.id,
        ...(dateFrom ? { createdAt: { gte: dateFrom } } : {}),
      },
    },
    select: {
      stake: true,
      resultValue: true,
      league: true,
      event: { select: { sport: true } },
    },
  });

  const summarizeBreakdown = (
    items: Array<{
      label: string | null;
      _count: { id: number };
      _sum: { stake: Prisma.Decimal | null; resultValue: Prisma.Decimal | null };
    }>
  ) => {
    return items
      .map((item) => {
        const stake = Number(item._sum.stake ?? 0);
        const resultValue = Number(item._sum.resultValue ?? 0);
        const roiValue = stake > 0 ? ((resultValue - stake) / stake) * 100 : 0;
        return {
          label: item.label ?? "Unknown",
          stake,
          bets: item._count.id,
          roi: roiValue,
        };
      })
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 3);
  };

  const sportsAccumulator = new Map<string, { count: number; stake: number; result: number }>();
  const leaguesAccumulator = new Map<string, { count: number; stake: number; result: number }>();

  betBreakdown.forEach((bet) => {
    const stake = Number(bet.stake);
    const resultValue = Number(bet.resultValue ?? 0);
    const sport = bet.event?.sport ?? "Unknown";
    const league = bet.league ?? "Unknown";

    const sportEntry = sportsAccumulator.get(sport) ?? { count: 0, stake: 0, result: 0 };
    sportEntry.count += 1;
    sportEntry.stake += stake;
    sportEntry.result += resultValue;
    sportsAccumulator.set(sport, sportEntry);

    const leagueEntry = leaguesAccumulator.get(league) ?? { count: 0, stake: 0, result: 0 };
    leagueEntry.count += 1;
    leagueEntry.stake += stake;
    leagueEntry.result += resultValue;
    leaguesAccumulator.set(league, leagueEntry);
  });

  const sportsBreakdown = summarizeBreakdown(
    Array.from(sportsAccumulator.entries()).map(([label, data]) => ({
      label,
      _count: { id: data.count },
      _sum: { stake: new Prisma.Decimal(data.stake), resultValue: new Prisma.Decimal(data.result) },
    }))
  );
  const leaguesBreakdown = summarizeBreakdown(
    Array.from(leaguesAccumulator.entries()).map(([label, data]) => ({
      label,
      _count: { id: data.count },
      _sum: { stake: new Prisma.Decimal(data.stake), resultValue: new Prisma.Decimal(data.result) },
    }))
  );

  const history = await prisma.operation.findMany({
    where: {
      userId: session.user.id,
      actualReturn: { not: null },
      ...(dateFrom ? { updatedAt: { gte: dateFrom } } : {}),
    },
    orderBy: { updatedAt: "asc" },
    select: {
      updatedAt: true,
      actualReturn: true,
      totalStake: true,
    },
  });

  let cumulative = 0;
  const growthPoints = history.map((operation) => {
    const actual = Number(operation.actualReturn ?? 0);
    const stake = Number(operation.totalStake ?? 0);
    const net = actual - stake;
    cumulative += net;
    return {
      label: format(new Date(operation.updatedAt), "MMM d"),
      value: cumulative,
    };
  });

  const values = growthPoints.map((point) => point.value);
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const range = Math.max(maxValue - minValue, 1);

  const slices = bankrolls
    .map((bankroll, index) => {
      const value = Number(bankroll.currentBalance);
      return {
        label: bankroll.bookmakerName,
        value,
        color: colors[index % colors.length],
      };
    })
    .filter((slice) => slice.value > 0);

  const sumValues = slices.reduce((sum, slice) => sum + slice.value, 0);

  let start = 0;
  const gradients = slices.map((slice) => {
    const portion = sumValues > 0 ? (slice.value / sumValues) * 100 : 0;
    const stop = start + portion;
    const gradient = `${slice.color} ${start}% ${stop}%`;
    start = stop;
    return gradient;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor bankrolls, operations, and performance at a glance.
          </p>
        </div>
        <Button asChild variant="outline" aria-label="Export dashboard CSV">
          <Link href={`/api/export/dashboard${period === "all" ? "" : `?period=${period}`}`}>
            Export CSV
            <Download  />
          </Link>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {periodOptions.map((option) => (
            <Link
              key={option.value}
              href={option.value === "all" ? "/" : `/?period=${option.value}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                period === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/bankrolls" className="group relative rounded-lg bg-card p-4 shadow-sm">
          <ChevronRight className="absolute right-4 top-4 size-4 text-muted-foreground transition group-hover:text-foreground" />
          <p className="text-xs uppercase text-muted-foreground">Total Balance</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatCurrency(Number(totalBalance), bankrolls[0]?.currency ?? "BRL")}
          </p>
        </Link>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-2">
          <Link href="/operations" className="group relative rounded-lg bg-card p-4 shadow-sm">
            <ChevronRight className="absolute right-4 top-4 size-4 text-muted-foreground transition group-hover:text-foreground" />
            <p className="text-xs uppercase text-muted-foreground">
              Active Operations
            </p>
            <p className="mt-2 text-2xl font-semibold">{activeOperations}</p>
          </Link>
          <div className="relative rounded-lg bg-card p-4 shadow-sm">
            <p className="text-xs uppercase text-muted-foreground">ROI</p>
            <p
              className={`mt-2 flex items-center gap-2 text-2xl font-semibold ${
                roi.gte(0) ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {roi.gte(0) ? "↗" : "↘"}
              {roi.toFixed(2)}
              <span className="text-sm text-muted-foreground">%</span>
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr,2fr]">
        <div className="rounded-lg bg-card p-6 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Balance Breakdown</p>
          <div
            className="mx-auto mt-4 h-40 w-40 rounded-full border bg-muted/40"
            style={{
              backgroundImage: gradients.length
                ? `conic-gradient(${gradients.join(",")})`
                : undefined,
            }}
          />
          <div className="mt-6 grid gap-2 text-sm">
            {slices.map((slice) => (
              <div key={slice.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span>{slice.label}</span>
                </div>
                <span>{formatCurrency(slice.value, bankrolls[0]?.currency ?? "BRL")}</span>
              </div>
            ))}
            {!slices.length ? (
              <p className="text-xs text-muted-foreground">
                Add a bankroll to see the breakdown.
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-1">
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <p className="text-xs uppercase text-muted-foreground">Top Sports</p>
            <div className="mt-4 space-y-3 text-sm">
              {sportsBreakdown.length ? (
                sportsBreakdown.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.bets} bets • ROI {item.roi.toFixed(1)}%
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatCurrency(item.stake, bankrolls[0]?.currency ?? "BRL")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Record bets to see sports ROI.</p>
              )}
            </div>
          </div>
          <div className="rounded-lg bg-card p-6 shadow-sm">
            <p className="text-xs uppercase text-muted-foreground">Top Leagues</p>
            <div className="mt-4 space-y-3 text-sm">
              {leaguesBreakdown.length ? (
                leaguesBreakdown.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.bets} bets • ROI {item.roi.toFixed(1)}%
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatCurrency(item.stake, bankrolls[0]?.currency ?? "BRL")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Track leagues to unlock insights.</p>
              )}
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-card p-6 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Bankroll Growth</p>
          <div className="mt-4 h-40">
            {growthPoints.length ? (
              <div className="flex items-end gap-2 h-full">
                {growthPoints.map((point) => {
                  const normalized = ((point.value - minValue) / range) * 100;
                  return (
                    <div
                      key={`${point.label}-${point.value}`}
                    className="flex-1 rounded-full bg-linear-to-t from-primary to-transparent"
                      style={{ height: `${Math.max(6, normalized)}%` }}
                    >
                      <span className="sr-only">
                        {point.label}: {point.value.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Settled operations appear here once you log results.
              </p>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{growthPoints[0]?.label ?? "Start"}</span>
            <span>{growthPoints[growthPoints.length - 1]?.label ?? "Now"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
