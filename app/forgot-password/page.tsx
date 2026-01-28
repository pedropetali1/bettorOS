"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestPasswordReset } from "@/app/forgot-password/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ForgotPasswordState = {
  ok: boolean;
  message: string;
  resetUrl?: string;
  token?: string;
};

const initialState: ForgotPasswordState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Sending..." : "Generate reset token"}
    </Button>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>
            Enter your email and we will generate a reset token for now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Email</label>
              <Input name="email" type="email" placeholder="you@email.com" required />
            </div>
            <SubmitButton />
          </form>
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-500" : "text-sm text-destructive"}>
              {state.message}
            </p>
          ) : null}
          {state.ok && state.resetUrl ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              <p>Reset link:</p>
              <Link href={state.resetUrl} className="break-all text-primary underline">
                {state.resetUrl}
              </Link>
              <p className="mt-2">Token: {state.token}</p>
            </div>
          ) : null}
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
