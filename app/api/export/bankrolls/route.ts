import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/utils";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const bankrolls = await prisma.bankroll.findMany({
    where: { userId: session.user.id },
    orderBy: { bookmakerName: "asc" },
  });

  const headers = ["bankrollId", "bookmakerName", "currency", "currentBalance"];
  const rows = bankrolls.map((bankroll) => ({
    bankrollId: bankroll.id,
    bookmakerName: bankroll.bookmakerName,
    currency: bankroll.currency,
    currentBalance: bankroll.currentBalance.toString(),
  }));

  const csv = toCsv(headers, rows);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bankrolls.csv"',
    },
  });
}
