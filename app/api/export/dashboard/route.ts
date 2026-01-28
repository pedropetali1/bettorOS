import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/utils";

type DashboardPeriod = "7d" | "30d" | "90d" | "all";

const periodOptions: Array<{ value: DashboardPeriod }> = [
  { value: "7d" },
  { value: "30d" },
  { value: "90d" },
  { value: "all" },
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

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const { period, dateFrom } = resolvePeriodStart(searchParams.get("period") ?? undefined);

  const bankrolls = await prisma.bankroll.findMany({
    where: { userId: session.user.id },
    select: { currentBalance: true },
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

  const toRows = (section: string, map: Map<string, { count: number; stake: number; result: number }>) =>
    Array.from(map.entries()).map(([label, data]) => {
      const roiValue = data.stake > 0 ? ((data.result - data.stake) / data.stake) * 100 : 0;
      return {
        section,
        label,
        bets: data.count,
        stake: data.stake.toFixed(2),
        roi: roiValue.toFixed(2),
        value: "",
      };
    });

  const headers = ["section", "label", "bets", "stake", "roi", "value"];
  const rows = [
    {
      section: "Summary",
      label: `Period:${period}`,
      bets: "",
      stake: "",
      roi: "",
      value: "",
    },
    {
      section: "Summary",
      label: "TotalBalance",
      bets: "",
      stake: "",
      roi: "",
      value: totalBalance.toString(),
    },
    {
      section: "Summary",
      label: "ActiveOperations",
      bets: "",
      stake: "",
      roi: "",
      value: activeOperations.toString(),
    },
    {
      section: "Summary",
      label: "ROI",
      bets: "",
      stake: "",
      roi: "",
      value: roi.toFixed(2),
    },
    ...toRows("Sports", sportsAccumulator),
    ...toRows("Leagues", leaguesAccumulator),
  ];

  const csv = toCsv(headers, rows);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dashboard.csv"',
    },
  });
}
