"use server";

import { signOut } from "@/auth";

export async function signOutAction() {
  // Use relative redirect so Auth.js can resolve the correct origin.
  await signOut({ redirectTo: "/login" });
}
