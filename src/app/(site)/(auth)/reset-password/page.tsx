import type { Metadata } from 'next';
import { Card } from '@/components/ui';
import { AuthForm } from '@/components/site/auth-forms';
import { resetPasswordAction } from '../actions';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function Reset({ searchParams }: { searchParams: Promise<{ admin?: string }> }) {
  const { admin } = await searchParams;
  return (
    <div className="container-x max-w-md py-12">
      <Card className="p-6 sm:p-8">
        <h1 className="text-3xl">Choose a new password</h1>
        <div className="mt-6">
          <AuthForm action={resetPasswordAction} submit="Update password" pendingText="Updating…" hidden={{ admin: admin === '1' ? '1' : '0' }} fields={[
            { name: 'password', label: 'New password', type: 'password', autoComplete: 'new-password' },
            { name: 'confirm', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
          ]} />
        </div>
      </Card>
    </div>
  );
}
