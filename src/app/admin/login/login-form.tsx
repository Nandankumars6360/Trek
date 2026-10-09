'use client';
import { useActionState } from 'react';
import { Alert, Field, Input } from '@/components/ui';
import { PasswordInput, SubmitButton } from '@/components/client-ui';
import { adminLoginAction } from './actions';

export function AdminLoginForm() {
  const [state, action] = useActionState(adminLoginAction, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="username" required autoFocus /></Field>
      <Field label="Password" htmlFor="password"><PasswordInput id="password" name="password" autoComplete="current-password" required minLength={8} /></Field>
      {state && !state.ok && <Alert tone="error">{state.error}</Alert>}
      <SubmitButton variant="forest" className="w-full" pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
