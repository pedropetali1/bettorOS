"use server";

import { Prisma, type BetStatus, type OperationType } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findOrCreateEvent } from "@/lib/services/event-service";
import { operationSchema } from "@/lib/validations/operation";

type ActionResult = { ok: boolean; message: string };

const calculateTotals = (legs: Array<{ stake: Prisma.Decimal | number; odds: Prisma.Decimal | number }>) => {
  const totalStake = legs.reduce(
    (acc, leg) => acc.add(new Prisma.Decimal(leg.stake)),
    new Prisma.Decimal(0)
  );

  const expectedReturn = legs.reduce(
    (acc, leg) => acc.add(new Prisma.Decimal(leg.stake).mul(leg.odds)),
    new Prisma.Decimal(0)
  );

  return { totalStake, expectedReturn };
};

async function recomputeOperationTotals(tx: Prisma.TransactionClient, operationId: string) {
  const operation = await tx.operation.findUnique({
    where: { id: operationId },
    include: { legs: true },
  });

  if (!operation) return;

  const totalStake = operation.legs.reduce(
    (acc, leg) => acc.add(leg.stake),
    new Prisma.Decimal(0)
  );

  const expectedReturn = operation.legs.reduce(
    (acc, leg) => acc.add(leg.stake.mul(leg.odds)),
    new Prisma.Decimal(0)
  );

  const hasPending = operation.legs.some((leg) => leg.status === "PENDING");
  let actualReturn: Prisma.Decimal | null = null;
  let roi: Prisma.Decimal | null = null;
  let status: BetStatus = "PENDING";

  if (!hasPending && operation.legs.length > 0) {
    actualReturn = operation.legs.reduce(
      (acc, leg) => acc.add(leg.resultValue ?? 0),
      new Prisma.Decimal(0)
    );

    roi = totalStake.gt(0)
      ? actualReturn.sub(totalStake).div(totalStake)
      : new Prisma.Decimal(0);

    const hasLoss = operation.legs.some((leg) => leg.status === "LOST");
    const hasCashout = operation.legs.some((leg) => leg.status === "CASHED_OUT");
    const allVoid = operation.legs.every((leg) => leg.status === "VOID");

    if (hasLoss) {
      status = "LOST";
    } else if (hasCashout) {
      status = "CASHED_OUT";
    } else if (allVoid) {
      status = "VOID";
    } else {
      status = "WON";
    }
  }

  await tx.operation.update({
    where: { id: operationId },
    data: {
      totalStake,
      expectedReturn,
      actualReturn,
      roi,
      status,
    },
  });
}

export async function createOperation(input: unknown): Promise<ActionResult> {
  const parsed = operationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error?.issues?.[0]?.message ??
        "Invalid input.",
    };
  }

  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const { type, legs, description } = parsed.data;
  const matchedOdds =
    type === "MATCHED" && "matchedOdds" in parsed.data ? parsed.data.matchedOdds : undefined;

  try {
    await prisma.$transaction(async (tx) => {
      const bankrollIds = Array.from(new Set(legs.map((leg) => leg.bankrollId)));
      const bankrolls = await tx.bankroll.findMany({
        where: {
          id: { in: bankrollIds },
          userId: session.user.id,
        },
      });

      if (bankrolls.length !== bankrollIds.length) {
        throw new Error("One or more bankrolls are invalid.");
      }

      const bankrollMap = new Map(bankrolls.map((bankroll) => [bankroll.id, bankroll]));

      legs.forEach((leg) => {
        const bankroll = bankrollMap.get(leg.bankrollId);
        if (!bankroll) {
          throw new Error("Bankroll not found.");
        }
        if (bankroll.currentBalance.lt(leg.stake)) {
          throw new Error("Insufficient bankroll balance.");
        }
      });

      let totalStake: Prisma.Decimal;
      let finalExpectedReturn: Prisma.Decimal;

      if (type === "MATCHED") {
        totalStake = legs.reduce(
          (acc, leg) => acc.add(new Prisma.Decimal(leg.stake)),
          new Prisma.Decimal(0)
        );

        if (matchedOdds !== undefined && matchedOdds !== null) {
          finalExpectedReturn = totalStake.mul(new Prisma.Decimal(matchedOdds));
        } else {
          if (legs.some((leg) => !leg.odds)) {
            throw new Error("Provide odds for all legs or set multiple odds.");
          }
          const productOdds = legs.reduce(
            (acc, leg) => acc.mul(new Prisma.Decimal(leg.odds!)),
            new Prisma.Decimal(1)
          );
          finalExpectedReturn = totalStake.mul(productOdds);
        }
      } else {
        const totals = calculateTotals(legs as Array<{ stake: number; odds: number }>);
        totalStake = totals.totalStake;
        finalExpectedReturn = totals.expectedReturn;
      }

      const operation = await tx.operation.create({
        data: {
          userId: session.user.id,
          type: type as OperationType,
          totalStake,
          expectedReturn: finalExpectedReturn,
          description,
        },
      });

      const matchedOddsValue =
        matchedOdds !== undefined && matchedOdds !== null
          ? new Prisma.Decimal(matchedOdds)
          : null;

      for (const leg of legs) {
        const eventId = await findOrCreateEvent({
          name: leg.matchName,
          date: leg.eventDate,
          sport: leg.sport,
          client: tx,
        });

        const oddsValue =
          leg.odds !== undefined && leg.odds !== null
            ? new Prisma.Decimal(leg.odds)
            : matchedOddsValue && leg.stake > 0
              ? matchedOddsValue
              : new Prisma.Decimal(1);

        await tx.bet.create({
          data: {
            operationId: operation.id,
            eventId,
            bankrollId: leg.bankrollId,
            selection: leg.selection,
            odds: oddsValue,
            stake: leg.stake,
            league: leg.league,
          },
        });

        await tx.bankroll.update({
          where: { id: leg.bankrollId },
          data: { currentBalance: { decrement: leg.stake } },
        });
      }
    });

    revalidatePath("/operations");
    revalidatePath("/bankrolls");
    revalidatePath("/");
    return { ok: true, message: "Operation created successfully." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return { ok: false, message: "Failed to create operation." };
    }

    if (error instanceof Error) {
      return { ok: false, message: error.message };
    }

    return { ok: false, message: "Failed to create operation." };
  }
}

export async function getOperations() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const operations = await prisma.operation.findMany({
    where: { userId: session.user.id },
    include: {
      legs: {
        include: {
          bankroll: true,
          event: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return operations.map((operation) => ({
    id: operation.id,
    type: operation.type,
    status: operation.status,
    totalStake: operation.totalStake.toString(),
    expectedReturn: operation.expectedReturn?.toString() ?? null,
    actualReturn: operation.actualReturn?.toString() ?? null,
    description: operation.description ?? null,
    createdAt: operation.createdAt.toISOString(),
    legs: operation.legs.map((leg) => ({
      id: leg.id,
      selection: leg.selection,
      odds: leg.odds.toString(),
      stake: leg.stake.toString(),
      status: leg.status,
      resultValue: leg.resultValue?.toString() ?? null,
      bankrollName: leg.bankroll.bookmakerName,
      bankrollId: leg.bankrollId,
      matchName: leg.event?.name ?? "",
      eventDate: leg.event?.date?.toISOString() ?? null,
      sport: leg.event?.sport ?? null,
      league: leg.league ?? null,
    })),
  }));
}

export async function updateOperationDescription(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      operationId: z.string().min(1),
      description: z.string().trim().optional(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues?.[0]?.message ?? "Invalid input.",
    };
  }

  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    const result = await prisma.operation.updateMany({
      where: { id: parsed.data.operationId, userId: session.user.id },
      data: { description: parsed.data.description || null },
    });

    if (result.count === 0) {
      return { ok: false, message: "Operation not found." };
    }

    revalidatePath("/operations");
    return { ok: true, message: "Operation updated successfully." };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Failed to update operation." };
  }
}

export async function deleteOperation(operationId: string): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const operation = await tx.operation.findFirst({
        where: { id: operationId, userId: session.user.id },
        include: { legs: true },
      });

      if (!operation) {
        throw new Error("Operation not found.");
      }

      for (const leg of operation.legs) {
        const resultValue = leg.resultValue ?? new Prisma.Decimal(0);
        const delta = leg.stake.sub(resultValue);

        await tx.bankroll.update({
          where: { id: leg.bankrollId },
          data: { currentBalance: { increment: delta } },
        });
      }

      await tx.bet.deleteMany({ where: { operationId: operation.id } });
      await tx.operation.delete({ where: { id: operation.id } });
    });

    revalidatePath("/operations");
    revalidatePath("/bankrolls");
    revalidatePath("/");
    return { ok: true, message: "Operation deleted successfully." };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Failed to delete operation." };
  }
}

export async function updateOperationDetails(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      operationId: z.string().min(1),
      description: z.string().trim().optional(),
      legs: z.array(
        z.object({
          id: z.string().min(1),
          matchName: z.string().min(2),
          selection: z.string().min(2),
          odds: z.coerce.number().gt(1),
          stake: z.coerce.number().min(0),
          eventDate: z.coerce.date(),
          sport: z.string().trim().optional(),
          league: z.string().trim().optional(),
          bankrollId: z.string().min(1),
        })
      ),
    })
    .safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues?.[0]?.message ?? "Invalid input.",
    };
  }

  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const { operationId, description, legs } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const operation = await tx.operation.findFirst({
        where: { id: operationId, userId: session.user.id },
        include: { legs: true },
      });

      if (!operation) {
        throw new Error("Operation not found.");
      }

      if (operation.status !== "PENDING" || operation.legs.some((leg) => leg.status !== "PENDING")) {
        throw new Error("Only pending operations can be edited.");
      }

      const bankrollIds = Array.from(new Set(legs.map((leg) => leg.bankrollId)));
      const bankrolls = await tx.bankroll.findMany({
        where: { id: { in: bankrollIds }, userId: session.user.id },
        select: { id: true, currentBalance: true },
      });
      if (bankrolls.length !== bankrollIds.length) {
        throw new Error("One or more bankrolls are invalid.");
      }

      const bankrollMap = new Map(bankrolls.map((bankroll) => [bankroll.id, bankroll]));
      const existingLegs = new Map(operation.legs.map((leg) => [leg.id, leg]));

      for (const leg of legs) {
        const existing = existingLegs.get(leg.id);
        if (!existing) {
          throw new Error("Leg not found.");
        }

        const newStake = new Prisma.Decimal(leg.stake);
        if (existing.bankrollId === leg.bankrollId) {
          const delta = newStake.sub(existing.stake);
          if (delta.gt(0)) {
            const bankroll = bankrollMap.get(leg.bankrollId);
            if (!bankroll || bankroll.currentBalance.lt(delta)) {
              throw new Error("Insufficient bankroll balance.");
            }
            await tx.bankroll.update({
              where: { id: leg.bankrollId },
              data: { currentBalance: { decrement: delta } },
            });
          } else if (delta.lt(0)) {
            await tx.bankroll.update({
              where: { id: leg.bankrollId },
              data: { currentBalance: { increment: delta.abs() } },
            });
          }
        } else {
          await tx.bankroll.update({
            where: { id: existing.bankrollId },
            data: { currentBalance: { increment: existing.stake } },
          });

          const nextBankroll = bankrollMap.get(leg.bankrollId);
          if (!nextBankroll || nextBankroll.currentBalance.lt(newStake)) {
            throw new Error("Insufficient bankroll balance.");
          }

          await tx.bankroll.update({
            where: { id: leg.bankrollId },
            data: { currentBalance: { decrement: newStake } },
          });
        }

        const eventId = await findOrCreateEvent({
          name: leg.matchName,
          date: leg.eventDate,
          sport: leg.sport,
          client: tx,
        });

        await tx.bet.update({
          where: { id: leg.id },
          data: {
            selection: leg.selection,
            odds: new Prisma.Decimal(leg.odds),
            stake: new Prisma.Decimal(leg.stake),
            bankrollId: leg.bankrollId,
            league: leg.league?.trim() || null,
            eventId,
          },
        });
      }

      const refreshed = await tx.bet.findMany({
        where: { operationId },
        select: { stake: true, odds: true },
      });

      const totalStake = refreshed.reduce(
        (acc, leg) => acc.add(leg.stake),
        new Prisma.Decimal(0)
      );

      const expectedReturn =
        operation.type === "MATCHED"
          ? totalStake.mul(
              refreshed.reduce(
                (acc, leg) => acc.mul(leg.odds),
                new Prisma.Decimal(1)
              )
            )
          : refreshed.reduce(
              (acc, leg) => acc.add(leg.stake.mul(leg.odds)),
              new Prisma.Decimal(0)
            );

      await tx.operation.update({
        where: { id: operationId },
        data: {
          description: description?.trim() || null,
          totalStake,
          expectedReturn,
        },
      });
    });

    revalidatePath("/operations");
    revalidatePath("/bankrolls");
    revalidatePath("/");
    return { ok: true, message: "Operation updated successfully." };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Failed to update operation." };
  }
}

export async function updateBetStatus(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      betId: z.string().min(1),
      status: z.enum(["WON", "LOST", "VOID", "CASHED_OUT"]),
      resultValue: z.coerce.number().optional(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues?.[0]?.message ?? "Invalid input.",
    };
  }

  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const { betId, status, resultValue } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const bet = await tx.bet.findFirst({
        where: { id: betId, operation: { userId: session.user.id } },
        include: { bankroll: true },
      });

      if (!bet) {
        throw new Error("Bet not found.");
      }

      const stake = bet.stake;
      let newResultValue: Prisma.Decimal;

      if (status === "WON") {
        newResultValue = stake.mul(bet.odds);
      } else if (status === "LOST") {
        newResultValue = new Prisma.Decimal(0);
      } else if (status === "VOID") {
        newResultValue = stake;
      } else {
        if (resultValue === undefined || Number.isNaN(resultValue)) {
          throw new Error("Result value is required for cashout.");
        }
        newResultValue = new Prisma.Decimal(resultValue);
      }

      const oldResultValue = bet.resultValue ?? new Prisma.Decimal(0);
      const delta = newResultValue.sub(oldResultValue);

      await tx.bet.update({
        where: { id: bet.id },
        data: {
          status,
          resultValue: newResultValue,
        },
      });

      await tx.bankroll.update({
        where: { id: bet.bankrollId },
        data: { currentBalance: { increment: delta } },
      });

      await recomputeOperationTotals(tx, bet.operationId);
    });

    revalidatePath("/operations");
    revalidatePath("/bankrolls");
    revalidatePath("/");
    return { ok: true, message: "Bet updated successfully." };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, message: error.message };
    }

    return { ok: false, message: "Failed to update bet." };
  }
}

export async function deleteBet(betId: string): Promise<ActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const bet = await tx.bet.findFirst({
        where: { id: betId, operation: { userId: session.user.id } },
      });

      if (!bet) {
        throw new Error("Bet not found.");
      }

      const resultValue = bet.resultValue ?? new Prisma.Decimal(0);
      const delta = bet.stake.sub(resultValue);

      await tx.bet.delete({ where: { id: bet.id } });

      await tx.bankroll.update({
        where: { id: bet.bankrollId },
        data: { currentBalance: { increment: delta } },
      });

      const remaining = await tx.bet.count({
        where: { operationId: bet.operationId },
      });

      if (remaining === 0) {
        await tx.operation.delete({ where: { id: bet.operationId } });
      } else {
        await recomputeOperationTotals(tx, bet.operationId);
      }
    });

    revalidatePath("/operations");
    revalidatePath("/bankrolls");
    revalidatePath("/");
    return { ok: true, message: "Bet deleted successfully." };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, message: error.message };
    }

    return { ok: false, message: "Failed to delete bet." };
  }
}
