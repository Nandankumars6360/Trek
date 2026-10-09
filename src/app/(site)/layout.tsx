import { Header } from '@/components/site/header';
import { Footer } from '@/components/site/footer';
import { isSupabaseConfigured } from '@/lib/env';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {!isSupabaseConfigured && (
        <div className="bg-clay-100 px-4 py-2 text-center text-sm text-clay-700">
          Setup needed: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see README).
        </div>
      )}
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
