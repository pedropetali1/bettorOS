"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { settleOperation } from "@/lib/services/financial.service";

const settleSchema = z.object({
  operationId: z.string().min(1),
  status: z.enum(["PENDING", "WON", "LOST", "VOID", "CASHED_OUT"]),
  actualReturn: z.coerce.number().optional(),
  winningLegId: z.string().optional(),
});

type ActionResult = { ok: boolean; message: string };

export async function settleOperationAction(input: unknown): Promise<ActionResult> {
  const parsed = settleSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues?.[0]?.message ?? "Invalid input." };
  }

  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const operation = await prisma.operation.findFirst({
    where: { id: parsed.data.operationId, userId: session.user.id },
    select: { id: true },
  });

  if (!operation) {
    return { ok: false, message: "Operation not found." };
  }

  try {
    await settleOperation(parsed.data);

    revalidatePath("/operations");
    revalidatePath("/bankrolls");
    revalidatePath("/");

    return { ok: true, message: "Operation settled successfully." };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Failed to settle operation." };
  }
}
