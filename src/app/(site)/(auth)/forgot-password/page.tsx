import type { Metadata } from 'next';
import { Card } from '@/components/ui';
import { AuthForm } from '@/components/site/auth-forms';
import { forgotPasswordAction } from '../actions';

export const metadata: Metadata = { title: 'Reset password', robots: { index: false } };

export default async function Forgot({ searchParams }: { searchParams: Promise<{ admin?: string }> }) {
  const { admin } = await searchParams;
  return (
    <div className="container-x max-w-md py-12">
      <Card className="p-6 sm:p-8">
        <h1 className="text-3xl">Reset password</h1>
        <p className="mt-2 text-sm text-charcoal-600">We&apos;ll email you a link to choose a new password.</p>
        <div className="mt-6">
          <AuthForm action={forgotPasswordAction} submit="Send reset link" pendingText="Sending…" hidden={{ admin: admin === '1' ? '1' : '0' }}
            fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]} />
        </div>
      </Card>
    </div>
  );
}
