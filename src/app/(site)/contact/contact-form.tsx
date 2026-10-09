'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { Alert, Field, Input, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/client-ui';
import { contactAction } from './actions';

export function ContactForm() {
  const [state, action] = useActionState(contactAction, null);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Name" htmlFor="name" error={fe.name}><Input id="name" name="name" autoComplete="name" required aria-invalid={!!fe.name} /></Field>
      <Field label="Email" htmlFor="email" error={fe.email}><Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!fe.email} /></Field>
      <Field label="Phone (optional)" htmlFor="phone" error={fe.phone}><Input id="phone" name="phone" type="tel" inputMode="tel" aria-invalid={!!fe.phone} /></Field>
      <Field label="Subject" htmlFor="subject" error={fe.subject}><Input id="subject" name="subject" required aria-invalid={!!fe.subject} /></Field>
      <Field label="Message" htmlFor="message" error={fe.message} className="sm:col-span-2"><Textarea id="message" name="message" rows={5} required aria-invalid={!!fe.message} /></Field>
      <div aria-hidden className="absolute -left-[9999px]"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="flex items-start gap-3 text-sm sm:col-span-2">
        <input type="checkbox" name="privacy" className="mt-1 size-4 accent-forest-700" required />
        <span>I agree to the <Link href="/privacy" className="underline">Privacy Policy</Link>.</span>
      </label>
      {fe.privacy && <p role="alert" className="text-xs text-red-700 sm:col-span-2">{fe.privacy}</p>}
      {state && !state.ok && <Alert tone="error" className="sm:col-span-2">{state.error}</Alert>}
      <div className="sm:col-span-2"><SubmitButton pendingText="Sending…">Send message</SubmitButton></div>
    </form>
  );
}
