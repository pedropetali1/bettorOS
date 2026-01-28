"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { bankrollSchema } from "@/lib/validations/bankroll";

type ActionResult = {
  ok: boolean;
  message: string;
};

export async function createBankroll(input: unknown): Promise<ActionResult> {
  const parsed = bankrollSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });

  if (!user) {
    return { ok: false, message: "User not found. Please sign in again." };
  }

  const { bookmakerName, currency, initialBalance } = parsed.data;

  try {
    await prisma.bankroll.create({
      data: {
        userId: session.user.id,
        bookmakerName,
        currency,
        currentBalance: initialBalance,
      },
    });

    revalidatePath("/bankrolls");
    revalidatePath("/");
    return { ok: true, message: "Bankroll created successfully." };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, message: "Bankroll already exists." };
    }

    return { ok: false, message: "Failed to create bankroll." };
  }
}

export async function getBankrolls() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const bankrolls = await prisma.bankroll.findMany({
    where: { userId: session.user.id },
    orderBy: { bookmakerName: "asc" },
  });

  return bankrolls.map((bankroll) => ({
    id: bankroll.id,
    bookmakerName: bankroll.bookmakerName,
    currency: bankroll.currency,
    currentBalance: bankroll.currentBalance.toString(),
  }));
}
