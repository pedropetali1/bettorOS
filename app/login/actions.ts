"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";

type LoginState = {
  error?: string;
};

export async function authenticate(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    const emailValue = formData.get("email");
    const email = typeof emailValue === "string" ? emailValue : null;
    let redirectTo = "/";

    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { settings: true },
      });
      const settings =
        user?.settings && typeof user.settings === "object" ? user.settings : null;
      const hasCompleted = settings
        ? Boolean((settings as { onboardingCompleted?: boolean }).onboardingCompleted)
        : false;
      if (user && !hasCompleted) {
        redirectTo = "/onboarding";
      }
    }

    // Use relative path - NextAuth will use the request's origin (with trustHost: true)
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo,
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    if (
      error instanceof Error &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return { error: "Unable to sign in." };
  }
}
