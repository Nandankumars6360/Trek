import type { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import { ActionForm } from '@/components/admin/action-form';
import { PageHeader } from '@/components/admin/admin-ui';
import { Badge, Card, EmptyState, Select, buttonClass } from '@/components/ui';
import { adminOrError, requireAdmin } from '@/lib/auth';
import { formatDateTime, formatPhone } from '@/lib/format';
import type { ActionResult } from '@/lib/types';

export const metadata: Metadata = { title: 'Messages' };

async function setMessageStatus(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  'use server';
  const a = await adminOrError(); if (!a.ok) return a;
  const status = String(f.get('status'));
  if (!['new', 'read', 'resolved'].includes(status)) return { ok: false, error: 'Invalid status' };
  const { error } = await a.supabase.from('contact_messages').update({ status }).eq('id', String(f.get('id')));
  if (error) return { ok: false, error: 'Could not update.' };
  revalidatePath('/admin/messages');
  return { ok: true, message: 'Updated.' };
}

export default async function Messages({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase } = await requireAdmin();
  const { status } = await searchParams;
  let q = supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(100);
  if (status && ['new', 'read', 'resolved'].includes(status)) q = q.eq('status', status);
  else q = q.neq('status', 'resolved');
  const { data } = await q;
  return (
    <>
      <PageHeader title="Messages" />
      <form method="get" className="mb-4 flex gap-2">
        <Select name="status" defaultValue={status ?? ''} className="w-48" aria-label="Status"><option value="">Open (new + read)</option><option value="new">New</option><option value="read">Read</option><option value="resolved">Resolved</option></Select>
        <button className={buttonClass({ variant: 'secondary', size: 'sm' })}>Show</button>
      </form>
      <div className="space-y-3">
        {(data ?? []).length ? data!.map((m) => (
          <Card key={m.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-semibold">{m.subject}</p><p className="text-sm text-charcoal-600">{m.name} · <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`} className="text-forest-700 hover:underline">{m.email}</a>{m.phone ? ` · ${formatPhone(m.phone)}` : ''} · {formatDateTime(m.created_at)}</p></div>
              <Badge value={m.status} />
            </div>
            <p className="mt-3 whitespace-pre-line text-sm">{m.message}</p>
            <div className="mt-3 flex gap-2">
              {m.status !== 'read' && <ActionForm action={setMessageStatus} submit="Mark read" variant="secondary"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value="read" /></ActionForm>}
              {m.status !== 'resolved' && <ActionForm action={setMessageStatus} submit="Resolve" variant="forest"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value="resolved" /></ActionForm>}
            </div>
          </Card>
        )) : <EmptyState title="No messages" />}
      </div>
    </>
  );
}
