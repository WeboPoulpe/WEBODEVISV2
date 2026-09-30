import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');
  // /e/ : page de mission envoyée aux extras, qui n'ont pas de compte.
  const isPublicRoute =
    pathname.startsWith('/embed') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/p/') ||
    pathname.startsWith('/e/') ||
    pathname.startsWith('/reset-password');

  // Public routes — no auth required
  if (isPublicRoute) return NextResponse.next();

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Redirect unauthenticated users to /login
  if (!token && !isAuthRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from /login
  if (token && isAuthRoute) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
