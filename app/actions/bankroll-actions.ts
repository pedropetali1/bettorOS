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
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "debug-session",
      runId: "bankroll-action",
      hypothesisId: "D",
      location: "app/actions/bankroll-actions.ts:16",
      message: "createBankroll entry",
      data: {
        inputType: typeof input,
        inputKeys: input && typeof input === "object" ? Object.keys(input as object) : null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log
  const parsed = bankrollSchema.safeParse(input);

  if (!parsed.success) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "bankroll-action",
        hypothesisId: "E",
        location: "app/actions/bankroll-actions.ts:23",
        message: "Validation failed",
        data: {
          issuesCount: parsed.error.issues.length,
          firstIssue: parsed.error.issues[0]?.message ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const session = await auth();

  if (!session?.user?.id) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "bankroll-action",
        hypothesisId: "F",
        location: "app/actions/bankroll-actions.ts:33",
        message: "Unauthorized session",
        data: { hasSession: !!session, userId: session?.user?.id ?? null },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    throw new Error("Unauthorized");
  }

  const { bookmakerName, currency, initialBalance } = parsed.data;

  try {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "bankroll-action",
        hypothesisId: "G",
        location: "app/actions/bankroll-actions.ts:43",
        message: "Creating bankroll",
        data: {
          bookmakerName,
          currency,
          initialBalance,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
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
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "bankroll-action",
        hypothesisId: "H",
        location: "app/actions/bankroll-actions.ts:58",
        message: "Bankroll created",
        data: { ok: true },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    return { ok: true, message: "Bankroll created successfully." };
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "bankroll-action",
        hypothesisId: "I",
        location: "app/actions/bankroll-actions.ts:67",
        message: "Bankroll create error",
        data: {
          isKnownPrisma: error instanceof Prisma.PrismaClientKnownRequestError,
          prismaCode:
            error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
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
