import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/manrope';
import './globals.css';
import { publicEnv } from '@/lib/env';
import { getSettings } from '@/lib/settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: `${s.brandName} — ${s.tagline}`, template: `%s · ${s.brandName}` },
    description: s.heroSubtitle,
    openGraph: { type: 'website', siteName: s.brandName, locale: 'en_IN', title: s.brandName, description: s.heroSubtitle },
    twitter: { card: 'summary_large_image' },
    alternates: { canonical: '/' },
  };
}

export const viewport: Viewport = { themeColor: '#1f3d2b', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
