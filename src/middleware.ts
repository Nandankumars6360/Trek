import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refreshes the Supabase session cookie and keeps signed-out visitors out of
// private areas. Real authorisation is re-checked on the server for every page and action.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (path.startsWith('/admin') && path !== '/admin/login' && !user) {
    const to = request.nextUrl.clone();
    to.pathname = '/admin/login';
    to.search = '';
    return NextResponse.redirect(to);
  }
  if (path.startsWith('/my-bookings') && !user) {
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    to.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(to);
  }

  // private pages must never be indexed or cached by shared caches
  if (path.startsWith('/admin') || path.startsWith('/my-bookings') || path.startsWith('/booking-confirmation')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/razorpay/webhook|api/cron).*)'],
};
