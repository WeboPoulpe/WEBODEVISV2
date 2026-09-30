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
    // /d/ : devis consulté par le client, à partir du lien reçu par email.
    pathname.startsWith('/d/') ||
    pathname.startsWith('/reset-password') ||
    // /site : le site de présentation, ouvert à tous.
    pathname === '/site' ||
    pathname.startsWith('/site/') ||
    // Fichiers de l'app installable : ils doivent se charger sans session.
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/hors-ligne' ||
    pathname.startsWith('/icons/');

  // Public routes — no auth required
  if (isPublicRoute) return NextResponse.next();

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Sans session, l'adresse du site montre la présentation du logiciel. L'app installée s'ouvre avec
  // ?source=pwa : elle va droit à la connexion.
  if (!token && pathname === '/' && !request.nextUrl.searchParams.has('source')) {
    const siteUrl = request.nextUrl.clone();
    siteUrl.pathname = '/site';
    return NextResponse.rewrite(siteUrl);
  }

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
