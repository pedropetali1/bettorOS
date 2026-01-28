"use server";

import crypto from "crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

type ForgotPasswordState = {
  ok: boolean;
  message: string;
  resetUrl?: string;
  token?: string;
};

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email."),
});

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid email.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, password: true },
  });

  if (!user || !user.password) {
    return {
      ok: false,
      message: "We couldn't find an account with that email.",
    };
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60);

  await prisma.verificationToken.deleteMany({
    where: { identifier: parsed.data.email },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: parsed.data.email,
      token,
      expires,
    },
  });

  return {
    ok: true,
    message: "Use the token below to reset your password.",
    token,
    resetUrl: `/reset-password?token=${token}`,
  };
}
