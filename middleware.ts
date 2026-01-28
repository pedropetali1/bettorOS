import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|login|register|forgot-password|reset-password|_next|favicon.ico).*)",
  ],
};
