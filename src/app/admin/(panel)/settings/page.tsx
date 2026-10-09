import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { KV, PageHeader, Section, Table, Td } from '@/components/admin/admin-ui';
import { Badge, Field, Textarea } from '@/components/ui';
import { requireManager } from '@/lib/auth';
import { isRazorpayConfigured, publicEnv, serverEnv } from '@/lib/env';
import { formatDateTime, titleCase } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { retryEmailsAction, saveBookingSettingsAction } from './actions';

export const metadata: Metadata = { title: 'Settings' };

export default async function Settings() {
  const { supabase } = await requireManager();
  const s = await getSettings();
  const env = serverEnv();
  const [{ data: admins }, { data: failed }] = await Promise.all([
    supabase.from('admin_users').select('user_id, role, is_active, created_at').order('created_at'),
    supabase.from('email_log').select('id, template, to_email, error, attempts, created_at').eq('status', 'failed').order('created_at', { ascending: false }).limit(20),
  ]);
  const retryAction = async () => { 'use server'; return retryEmailsAction(); };

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Bookings & payments">
          <ActionForm action={saveBookingSettingsAction} submit="Save settings" variant="forest">
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="require_approval" defaultChecked={s.requireApproval} className="mt-1 accent-forest-700" />
              <span><b>Approve bookings manually</b><br /><span className="text-charcoal-600">New pay-later bookings start as Pending until you confirm them. Turn off to confirm instantly.</span></span></label>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="online_enabled" defaultChecked={s.onlinePaymentsEnabled} disabled={!isRazorpayConfigured()} className="mt-1 accent-forest-700" />
              <span><b>Online payments (Razorpay)</b><br /><span className="text-charcoal-600">{isRazorpayConfigured() ? 'Customers can pay online; bookings confirm automatically once payment is verified.' : 'Not available until Razorpay keys are configured.'}</span></span></label>
            <Field label="Pay-later instructions (shown to customers)" htmlFor="manual_instructions">
              <Textarea id="manual_instructions" name="manual_instructions" rows={3} defaultValue={s.manualInstructions} />
            </Field>
          </ActionForm>
        </Section>

        <Section title="Integrations">
          <KV rows={[
            ['Site URL', publicEnv.siteUrl],
            ['Email', env.emailMode === 'live' ? <Badge key="e" value="sent" label={`Live via Resend (${env.emailFrom})`} /> : <Badge key="e" value="skipped" label="Log only — not sending" />],
            ['Razorpay', isRazorpayConfigured() ? <Badge key="r" value="sent" label="Configured" /> : <Badge key="r" value="skipped" label="Not configured" />],
            ['Scheduled jobs', env.cronSecret ? <Badge key="c" value="sent" label="CRON_SECRET set" /> : <Badge key="c" value="failed" label="CRON_SECRET missing" />],
            ['Policy version', s.policyVersion],
          ]} />
        </Section>

        <Section title="Team">
          <Table head={['User ID', 'Role', 'Active', 'Added']} empty={!admins?.length}>
            {(admins ?? []).map((a) => <tr key={a.user_id}><Td className="font-mono text-xs">{a.user_id}</Td><Td>{titleCase(a.role)}</Td><Td>{a.is_active ? 'Yes' : 'No'}</Td><Td className="text-xs">{formatDateTime(a.created_at)}</Td></tr>)}
          </Table>
          <p className="mt-3 text-sm text-charcoal-600">Admin access can only be granted in the Supabase SQL editor (never from the website). See README → “Add another admin”.</p>
        </Section>

        <Section title="Failed emails" actions={<ActionForm action={retryAction} submit="Retry now" variant="secondary" />}>
          <div id="emails" />
          {(failed ?? []).length ? (
            <ul className="space-y-2 text-sm">{failed!.map((e) => <li key={e.id}><b>{titleCase(e.template)}</b> → {e.to_email} · {e.attempts} attempt(s) · {formatDateTime(e.created_at)}<div className="text-xs text-red-700">{e.error}</div></li>)}</ul>
          ) : <p className="text-sm text-charcoal-600">No failed emails.</p>}
        </Section>
      </div>
    </>
  );
}
