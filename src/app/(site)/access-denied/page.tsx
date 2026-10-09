import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui';
import { logoutAction } from '../(auth)/actions';

export const metadata: Metadata = { title: 'Access denied', robots: { index: false } };

export default function AccessDenied() {
  return (
    <div className="container-x max-w-xl py-24 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-clay-600">403</p>
      <h1 className="mt-2 text-4xl">You don&apos;t have access to this page</h1>
      <p className="mt-3 text-charcoal-600">This area is for the organising team. If you think you should have access, ask the owner to add you.</p>
      <div className="mt-8 flex justify-center gap-3">
        <ButtonLink href="/">Go home</ButtonLink>
        <form action={logoutAction}><button className="rounded-full px-5 py-2.5 text-sm font-semibold text-forest-900 hover:bg-sand-100">Sign out</button></form>
      </div>
    </div>
  );
}
