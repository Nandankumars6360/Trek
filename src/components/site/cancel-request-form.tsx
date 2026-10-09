'use client';
import { useActionState } from 'react';
import { Alert, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/client-ui';
import type { ActionResult } from '@/lib/types';

export function CancelRequestForm({ action, hidden }: {
  action: (s: ActionResult | null, f: FormData) => Promise<ActionResult>; hidden: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, null);
  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={formAction} className="space-y-3">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label htmlFor="reason" className="block text-sm font-semibold">Reason for cancelling</label>
      <Textarea id="reason" name="reason" rows={3} required minLength={3} maxLength={1000} />
      {state && !state.ok && <Alert tone="error">{state.error}</Alert>}
      <SubmitButton variant="secondary" pendingText="Sending…">Request cancellation</SubmitButton>
    </form>
  );
}
