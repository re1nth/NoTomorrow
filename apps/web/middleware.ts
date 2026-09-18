import { NextResponse, type NextRequest } from 'next/server';
import { pathAllowedForRole, serviceRole } from './lib/service-role';

export function middleware(req: NextRequest) {
  const role = serviceRole();
  if (pathAllowedForRole(req.nextUrl.pathname, role)) {
    const response = NextResponse.next();
    response.headers.set('x-notomorrow-service-role', role);
    return response;
  }

  return NextResponse.json(
    { error: `route unavailable on ${role} service` },
    { status: 404, headers: { 'x-notomorrow-service-role': role } },
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|stickers).*)'],
};
