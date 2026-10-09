'use server';
import { revalidatePath } from 'next/cache';
import { adminOrError } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import type { ActionResult } from '@/lib/types';

export async function addCustomerNoteAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const a = await adminOrError(); if (!a.ok) return a;
  const email = String(f.get('email') ?? '').trim().toLowerCase();
  const note = String(f.get('note') ?? '').trim().slice(0, 2000);
  if (!email || !note) return { ok: false, error: 'Write a note first.' };
  const { error } = await a.supabase.from('customer_notes').insert({ email, note, author_id: a.user.id });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/admin/customers');
  return { ok: true, message: 'Note added.' };
}
