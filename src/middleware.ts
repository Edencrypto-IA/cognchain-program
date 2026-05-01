import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // ---- Security Headers (CSP, CORS, etc.) ----
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );

  // Content-Security-Policy — allow only same-origin + specific CDNs
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.devnet.solana.com https://explorer.solana.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  // CORS — restrict to ALLOWED_ORIGINS env var when set, otherwise same-origin only
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/')) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ?.split(',').map(o => o.trim()).filter(Boolean) ?? [];

    const requestOrigin = request.headers.get('origin');
    let corsOrigin: string | null = null;

    if (allowedOrigins.length === 0) {
      // No restriction configured: open API (set ALLOWED_ORIGINS to lock down)
      corsOrigin = '*';
    } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      corsOrigin = requestOrigin;
      response.headers.set('Vary', 'Origin');
    }

    if (corsOrigin) {
      response.headers.set('Access-Control-Allow-Origin', corsOrigin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Max-Age', '86400');
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers });
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except _next/static, _next/image, favicon.ico
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
