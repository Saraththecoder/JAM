import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/register', '/verify', '/privacy', '/.well-known'];
const PUBLIC_API_PATHS = ['/api/health', '/api/download-letter'];

function isPublicPath(path: string): boolean {
  return (
    PUBLIC_PATHS.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`)) ||
    PUBLIC_API_PATHS.some((apiPath) => path === apiPath || path.startsWith(`${apiPath}/`))
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const path = url.pathname;
  const isApiPath = path.startsWith('/api/');

  // Reject cross-site state-changing API requests. Server-to-server calls
  // without an Origin header are still allowed; browsers always send Origin
  // for non-GET fetch/XHR requests.
  if (isApiPath && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    let configuredOrigin: string | null = null;
    if (process.env.NEXT_PUBLIC_APP_URL) {
      try {
        configuredOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
      } catch {
        configuredOrigin = null;
      }
    }
    const allowedOrigins = new Set([request.nextUrl.origin]);
    if (configuredOrigin) allowedOrigins.add(configuredOrigin);

    if (origin && !allowedOrigins.has(origin)) {
      return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
  }

  if (!user && !isPublicPath(path)) {
    if (isApiPath) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // API routes perform their own profile/role checks with the service role.
  // The proxy only needs the profile for page-level redirects.
  if (user && !isApiPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      url.pathname = '/login';
      url.searchParams.set('error', 'profile');
      return NextResponse.redirect(url);
    }

    if (path === '/login' || path.startsWith('/register')) {
      url.pathname = profile.role === 'faculty' ? '/faculty/dashboard' : '/student/dashboard';
      return NextResponse.redirect(url);
    }

    if (path.startsWith('/faculty') && profile.role !== 'faculty') {
      url.pathname = '/student/dashboard';
      return NextResponse.redirect(url);
    }

    if (path.startsWith('/student') && profile.role !== 'student') {
      url.pathname = '/faculty/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and public PWA files.
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
