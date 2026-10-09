'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { Spinner } from '@/components/client-ui';

type RazorpayHandlerResp = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }
}

function loadScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load payment window'));
    document.body.appendChild(s);
  });
}

export function PayButton({ reference, token, amountLabel, brand, prefill }: {
  reference: string; token: string; amountLabel: string; brand: string; prefill: { name: string; email: string; contact: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);

  async function pay() {
    setBusy(true); setMsg(null);
    try {
      await loadScript();
      const res = await fetch('/api/payments/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference, token }) });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error ?? 'Could not start payment');
      const rzp = new window.Razorpay!({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: 'INR', name: brand,
        description: `Booking ${reference}`, prefill, theme: { color: '#1f3d2b' },
        handler: async (r: RazorpayHandlerResp) => {
          setMsg({ tone: 'info', text: 'Verifying payment…' });
          const v = await fetch('/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, reference, token }) });
          const body = await v.json();
          setMsg(v.ok ? { tone: 'success', text: 'Payment verified. Thank you!' } : { tone: 'error', text: body.error ?? 'We could not verify the payment yet. If money was debited it will update automatically.' });
          router.refresh();
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on('payment.failed', () => setMsg({ tone: 'error', text: 'Payment failed. No money was taken — you can try again.' }));
      rzp.open();
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" size="lg" onClick={pay} disabled={busy}>{busy && <Spinner />}Pay {amountLabel} online</Button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
