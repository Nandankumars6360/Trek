'use client';
import { useFormStatus } from 'react-dom';
import { useState, type ComponentProps } from 'react';
import { buttonClass, cn } from './ui';

export function SubmitButton({ children, pendingText = 'Saving…', variant, size, className, ...p }:
  ComponentProps<'button'> & { pendingText?: string; variant?: 'primary' | 'forest' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' }) {
  const { pending } = useFormStatus();
  return (
    <button {...p} type="submit" disabled={pending || p.disabled} aria-busy={pending}
      className={cn(buttonClass({ variant, size }), className)}>
      {pending && <Spinner />}{pending ? pendingText : children}
    </button>
  );
}

export function Spinner() {
  return <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

export function ConfirmSubmit({ message, children, ...p }: ComponentProps<typeof SubmitButton> & { message: string }) {
  return <SubmitButton {...p} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>{children}</SubmitButton>;
}

export function PrintButton({ className }: { className?: string }) {
  return <button type="button" onClick={() => window.print()} className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), 'no-print', className)}>Print / Save PDF</button>;
}

export function PasswordInput(p: ComponentProps<'input'>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...p} type={show ? 'text' : 'password'}
        className="w-full rounded-xl border border-sand-200 bg-white px-3.5 py-2.5 pr-16 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/20 aria-[invalid=true]:border-red-600" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs font-semibold text-forest-700 hover:bg-sand-100">
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
