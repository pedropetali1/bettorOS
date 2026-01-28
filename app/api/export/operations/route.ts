import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/utils";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const operations = await prisma.operation.findMany({
    where: { userId: session.user.id },
    include: {
      legs: {
        include: {
          bankroll: { select: { bookmakerName: true } },
          event: { select: { name: true, date: true, sport: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "operationId",
    "type",
    "status",
    "totalStake",
    "expectedReturn",
    "actualReturn",
    "roi",
    "description",
    "createdAt",
    "legId",
    "matchName",
    "eventDate",
    "sport",
    "league",
    "selection",
    "odds",
    "stake",
    "legStatus",
    "legResult",
    "bankroll",
  ];

  const rows = operations.flatMap((operation) =>
    operation.legs.map((leg) => ({
      operationId: operation.id,
      type: operation.type,
      status: operation.status,
      totalStake: operation.totalStake.toString(),
      expectedReturn: operation.expectedReturn?.toString() ?? "",
      actualReturn: operation.actualReturn?.toString() ?? "",
      roi: operation.roi?.toString() ?? "",
      description: operation.description ?? "",
      createdAt: operation.createdAt.toISOString(),
      legId: leg.id,
      matchName: leg.event?.name ?? "",
      eventDate: leg.event?.date?.toISOString() ?? "",
      sport: leg.event?.sport ?? "",
      league: leg.league ?? "",
      selection: leg.selection,
      odds: leg.odds.toString(),
      stake: leg.stake.toString(),
      legStatus: leg.status,
      legResult: leg.resultValue?.toString() ?? "",
      bankroll: leg.bankroll.bookmakerName,
    }))
  );

  const csv = toCsv(headers, rows);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="operations.csv"',
    },
  });
}
