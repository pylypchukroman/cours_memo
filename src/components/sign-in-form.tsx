"use client";

import { useActionState } from "react";

import { sendMagicLink, signIn, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SignInForm({ nextPath }: { nextPath: string }) {
  const [passwordState, passwordAction, passwordPending] = useActionState<AuthState, FormData>(signIn, null);
  const [linkState, linkAction, linkPending] = useActionState<AuthState, FormData>(sendMagicLink, null);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Email and password</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={passwordAction} className="grid gap-3">
            <input type="hidden" name="next" value={nextPath} />
            <label className="grid gap-1 text-sm">
              Email
              <Input name="email" type="email" autoComplete="email" required />
            </label>
            <label className="grid gap-1 text-sm">
              Password
              <Input name="password" type="password" autoComplete="current-password" required />
            </label>
            {passwordState?.error ? <p className="text-sm text-destructive">{passwordState.error}</p> : null}
            <Button type="submit" disabled={passwordPending}>
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Email link</CardTitle>
          <CardDescription>We will send a one-time sign-in link</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={linkAction} className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Email
              <Input name="email" type="email" autoComplete="email" required />
            </label>
            {linkState?.error ? <p className="text-sm text-destructive">{linkState.error}</p> : null}
            {linkState?.message ? <p className="text-sm text-muted-foreground">{linkState.message}</p> : null}
            <Button type="submit" variant="outline" disabled={linkPending}>
              Send link
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
