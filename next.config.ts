import type { NextConfig } from 'next';

const supabaseHost = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname; } catch { return 'localhost'; }
})();

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabaseHost}`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://api.razorpay.com https://lumberjack.razorpay.com`,
  'frame-src https://api.razorpay.com https://checkout.razorpay.com',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }],
  },
  experimental: { serverActions: { bodySizeLimit: '6mb' } },   // image uploads (5 MB limit + form overhead)
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")' },
      ],
    }];
  },
};

export default nextConfig;
