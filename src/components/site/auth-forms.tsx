'use client';
import { useActionState, useId } from 'react';
import { Alert, Field, Input } from '@/components/ui';
import { PasswordInput, SubmitButton } from '@/components/client-ui';
import type { ActionResult } from '@/lib/types';

type Action = (s: ActionResult | null, f: FormData) => Promise<ActionResult>;
type F = { name: string; label: string; type?: 'email' | 'password' | 'text'; autoComplete?: string; hint?: string };

export function AuthForm({ action, fields, submit, pendingText, hidden = {} }: {
  action: Action; fields: F[]; submit: string; pendingText: string; hidden?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, null);
  const uid = useId();                      // unique ids even with two forms on one page
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  if (state?.ok && state.message) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => (
        <Field key={f.name} label={f.label} htmlFor={`${uid}-${f.name}`} error={fe[f.name]} hint={f.hint}>
          {f.type === 'password'
            ? <PasswordInput id={`${uid}-${f.name}`} name={f.name} autoComplete={f.autoComplete} required minLength={8} aria-invalid={!!fe[f.name]} />
            : <Input id={`${uid}-${f.name}`} name={f.name} type={f.type ?? 'text'} autoComplete={f.autoComplete} required aria-invalid={!!fe[f.name]} />}
        </Field>
      ))}
      {state && !state.ok && <Alert tone="error">{state.error}</Alert>}
      <SubmitButton pendingText={pendingText} className="w-full">{submit}</SubmitButton>
    </form>
  );
}
