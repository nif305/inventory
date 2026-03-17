import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
const PUBLIC_FILE = /\.(.*)$/;
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_FILE.test(pathname) || pathname.startsWith('/api')) return NextResponse.next();
  const session = request.cookies.get('inventory_platform_session');
  const userRole = request.cookies.get('user_role')?.value as 'manager' | 'warehouse' | 'user' | undefined;
  const userStatus = request.cookies.get('user_status')?.value;
  const isAuthenticated = !!session;
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/request-account') || pathname.startsWith('/pending-approval');
  const protectedRoutes = ['dashboard','inventory','requests','approvals','users','audit-logs','custody','returns','maintenance','email-drafts','notifications','reports','suggestions','purchases','messages','archive'];
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(`/${route}`));
  if (!isAuthenticated && isProtected) return NextResponse.redirect(new URL('/login', request.url));
  if (isAuthenticated && userStatus === 'pending' && !pathname.startsWith('/pending-approval')) return NextResponse.redirect(new URL('/pending-approval', request.url));
  if (isAuthenticated && isAuthPage && userStatus !== 'pending') return NextResponse.redirect(new URL('/dashboard', request.url));
  const managerOnlyRoutes = ['/users', '/audit-logs', '/approvals', '/email-drafts', '/archive'];
  if (managerOnlyRoutes.some((route) => pathname.startsWith(route)) && userRole !== 'manager') {
    return NextResponse.redirect(new URL('/dashboard?error=unauthorized', request.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
