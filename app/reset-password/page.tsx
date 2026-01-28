"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { resetPassword } from "@/app/reset-password/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ResetPasswordState = {
  ok: boolean;
  message: string;
};

const initialState: ResetPasswordState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Updating..." : "Update password"}
    </Button>
  );
}

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, formAction] = useActionState(resetPassword, initialState);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>Use the token you generated to reset your password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Token</label>
              <Input name="token" defaultValue={token} placeholder="Reset token" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">New password</label>
              <Input name="password" type="password" placeholder="••••••••" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Confirm password</label>
              <Input name="confirmPassword" type="password" placeholder="••••••••" required />
            </div>
            <SubmitButton />
          </form>
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-500" : "text-sm text-destructive"}>
              {state.message}
            </p>
          ) : null}
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
