'use client';
import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { SubmitButton } from '@/components/client-ui';
import { cn } from '@/components/ui';
import type { ActionResult } from '@/lib/types';

type Action = (s: ActionResult | null, f: FormData) => Promise<ActionResult>;

/** Small wrapper for admin forms: shows pending state, success and errors inline. */
export function ActionForm({ action, children, submit = 'Save', pendingText = 'Saving…', confirm, variant, size = 'sm',
  className, resetOnSuccess = false, inline = false }: {
  action: Action; children?: ReactNode; submit?: string; pendingText?: string; confirm?: string;
  variant?: 'primary' | 'forest' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; className?: string;
  resetOnSuccess?: boolean; inline?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form ref={ref} action={formAction} className={cn(inline ? 'flex flex-wrap items-end gap-2' : 'space-y-3', className)}
      onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {children}
      <div className={cn('flex flex-wrap items-center gap-3', inline && 'pb-0.5')}>
        <SubmitButton variant={variant} size={size} pendingText={pendingText}>{submit}</SubmitButton>
        {state && (
          <span role={state.ok ? 'status' : 'alert'} className={cn('text-sm', state.ok ? 'text-forest-700' : 'text-red-700')}>
            {state.ok ? state.message ?? 'Saved.' : state.error}
          </span>
        )}
      </div>
      {fe && Object.keys(fe).length > 0 && (
        <ul className="list-disc pl-5 text-xs text-red-700">{Object.entries(fe).map(([k, v]) => <li key={k}><b>{k.replace(/_/g, ' ')}</b>: {v}</li>)}</ul>
      )}
    </form>
  );
}
