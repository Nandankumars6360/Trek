import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '@/lib/csv';
import { errorCode, friendlyError } from '@/lib/errors';
import { formatINR, rupeesToPaise } from '@/lib/format';
import { verifyCheckoutSignature, verifyWebhookSignature } from '@/lib/payments/razorpay';
import { sniffImage } from '@/lib/uploads';

describe('CSV export', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });
  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+91 98765')).toBe("'+91 98765");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
  it('builds a file with BOM and CRLF rows', () => {
    const out = toCsv(['A', 'B'], [[1, null], ['x', 'y']]);
    expect(out.startsWith('﻿A,B\r\n1,\r\nx,y\r\n')).toBe(true);
  });
});

describe('Razorpay signatures', () => {
  const secret = 'test_secret';
  it('accepts a correct checkout signature and rejects tampering', () => {
    const sig = crypto.createHmac('sha256', secret).update('order_1|pay_1').digest('hex');
    expect(verifyCheckoutSignature('order_1', 'pay_1', sig, secret)).toBe(true);
    expect(verifyCheckoutSignature('order_1', 'pay_2', sig, secret)).toBe(false);
    expect(verifyCheckoutSignature('order_1', 'pay_1', sig.replace(/.$/, '0'), secret)).toBe(false);
    expect(verifyCheckoutSignature('order_1', 'pay_1', '', secret)).toBe(false);
    expect(verifyCheckoutSignature('order_1', 'pay_1', sig, '')).toBe(false);
  });
  it('verifies webhook bodies exactly as received', () => {
    const body = '{"event":"payment.captured","payload":{}}';
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyWebhookSignature(body.replace('captured', 'failed'), sig, secret)).toBe(false);
  });
});

describe('image uploads', () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
  it('detects real image types from content', () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe('image/jpeg');
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47))?.mime).toBe('image/png');
    expect(sniffImage(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')))?.mime).toBe('image/webp');
    expect(sniffImage(bytes(0, 0, 0, 0x1c, ...ascii('ftypavif')))?.mime).toBe('image/avif');
  });
  it('rejects scripts, SVG and HTML pretending to be images', () => {
    expect(sniffImage(new TextEncoder().encode('<svg onload="alert(1)">'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode('<html><script>'))).toBeNull();
    expect(sniffImage(bytes(0x4d, 0x5a))).toBeNull(); // .exe
  });
});

describe('error messages', () => {
  it('maps database codes to friendly text and hides internals', () => {
    expect(errorCode({ message: 'NOT_ENOUGH_SEATS' })).toBe('NOT_ENOUGH_SEATS');
    expect(friendlyError({ message: 'NOT_ENOUGH_SEATS', details: '2 seat(s) left' })).toContain('2 seat(s) left');
    expect(friendlyError({ message: 'relation "secret_table" does not exist' })).toBe('Something went wrong. Please try again.');
    expect(friendlyError({ message: 'x', code: '23503' })).toMatch(/Archive it instead/);
  });
});

describe('money', () => {
  it('formats paise as rupees and parses input', () => {
    expect(formatINR(179800)).toBe('₹1,798');
    expect(formatINR(109950)).toBe('₹1,099.50');
    expect(rupeesToPaise('1,099.50')).toBe(109950);
    expect(rupeesToPaise('-5')).toBeNaN();
  });
});
