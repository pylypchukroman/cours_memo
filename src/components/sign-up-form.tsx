"use client";

import { useActionState } from "react";

import { signUp, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignUpForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, null);

  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Email
        <Input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="grid gap-1 text-sm">
        Password
        <Input name="password" type="password" autoComplete="new-password" minLength={6} required />
      </label>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        Create account
      </Button>
    </form>
  );
}
