"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

type ResetPasswordState = {
  ok: boolean;
  message: string;
};

const resetSchema = z
  .object({
    token: z.string().min(10, "Token is required."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z.string().min(6, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const tokenRecord = await prisma.verificationToken.findUnique({
    where: { token: parsed.data.token },
  });

  if (!tokenRecord) {
    return { ok: false, message: "Invalid or expired token." };
  }

  if (tokenRecord.expires < new Date()) {
    await prisma.verificationToken.deleteMany({
      where: { identifier: tokenRecord.identifier },
    });
    return { ok: false, message: "Token expired. Request a new one." };
  }

  const user = await prisma.user.findUnique({
    where: { email: tokenRecord.identifier },
    select: { id: true },
  });

  if (!user) {
    return { ok: false, message: "User not found." };
  }

  const hashed = await bcrypt.hash(parsed.data.password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    }),
    prisma.verificationToken.deleteMany({
      where: { identifier: tokenRecord.identifier },
    }),
  ]);

  return { ok: true, message: "Password updated. You can sign in now." };
}
