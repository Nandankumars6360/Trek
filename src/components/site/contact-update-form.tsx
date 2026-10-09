'use client';
import { useActionState } from 'react';
import { Alert, Field, Input } from '@/components/ui';
import { SubmitButton } from '@/components/client-ui';
import type { ActionResult } from '@/lib/types';

export function ContactUpdateForm({ action, bookingId, phone, emergencyName, emergencyPhone }: {
  action: (s: ActionResult | null, f: FormData) => Promise<ActionResult>;
  bookingId: string; phone: string; emergencyName: string; emergencyPhone: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <Field label="Your mobile" htmlFor={`ph-${bookingId}`}><Input id={`ph-${bookingId}`} name="phone" defaultValue={phone} inputMode="tel" /></Field>
      <Field label="Emergency contact" htmlFor={`en-${bookingId}`}><Input id={`en-${bookingId}`} name="emergencyName" defaultValue={emergencyName} /></Field>
      <Field label="Emergency mobile" htmlFor={`ep-${bookingId}`}><Input id={`ep-${bookingId}`} name="emergencyPhone" defaultValue={emergencyPhone} inputMode="tel" /></Field>
      <div className="sm:col-span-3 flex items-center gap-3">
        <SubmitButton size="sm" variant="secondary">Save contact details</SubmitButton>
        {state && <span role="status" className={state.ok ? 'text-sm text-forest-700' : 'text-sm text-red-700'}>{state.ok ? state.message : state.error}</span>}
      </div>
      {state && !state.ok && <Alert tone="error" className="sm:col-span-3 hidden">{state.error}</Alert>}
    </form>
  );
}
