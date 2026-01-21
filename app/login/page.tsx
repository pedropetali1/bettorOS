import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/");
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-4">
      <LoginForm />
    </div>
  );
}
