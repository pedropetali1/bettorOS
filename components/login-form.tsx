"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { authenticate } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initialState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(authenticate, initialState);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Use your credentials to access BettorOS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Email</label>
            <Input name="email" type="email" placeholder="you@email.com" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Password</label>
            <Input name="password" type="password" placeholder="••••••••" required />
          </div>
          {state && "error" in state ? (
            <p className="text-sm text-destructive">{state.error as string}</p>
          ) : null}
          <SubmitButton />
          <Button asChild variant="link" className="w-full px-0 text-sm">
            <Link href="/forgot-password">Forgot your password?</Link>
          </Button>
        </form>
        <Button variant="outline" className="w-full" type="button" disabled>
          Sign in with Google (coming soon)
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/register">Create an account</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
