import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Retrieve current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Define public paths
  const isPublicPath =
    path === '/' ||
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/verify') ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/download-letter');

  // 1. Unauthenticated users: redirect to login if attempting private path
  if (!user && !isPublicPath) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2. Authenticated users: role-based access control
  if (user) {
    // Query public.profiles to get role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile) {
      // Prevent logged-in users from accessing /login or register paths
      if (path === '/login' || path.startsWith('/register')) {
        url.pathname =
          profile.role === 'faculty'
            ? '/faculty/dashboard'
            : '/student/dashboard';
        return NextResponse.redirect(url);
      }

      // Restrict students from accessing /faculty routes
      if (path.startsWith('/faculty') && profile.role !== 'faculty') {
        url.pathname = '/student/dashboard';
        return NextResponse.redirect(url);
      }

      // Restrict faculty from accessing /student routes
      if (path.startsWith('/student') && profile.role !== 'student') {
        url.pathname = '/faculty/dashboard';
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/signatures (allow displaying asset files)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
