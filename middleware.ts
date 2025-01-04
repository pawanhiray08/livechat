import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Remove any existing security headers to prevent conflicts
  response.headers.delete('Content-Security-Policy')
  response.headers.delete('Content-Security-Policy-Report-Only')
  response.headers.delete('X-Frame-Options')
  
  // Add security headers
  const ContentSecurityPolicy = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.vercel.app;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.googleusercontent.com;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
    connect-src 'self' 
      https://*.vercel.app
      https://*.googleapis.com 
      https://*.firebaseio.com 
      wss://*.firebaseio.com
      https://apis.google.com
      https://*.google.com;
  `

  response.headers.set(
    'Content-Security-Policy',
    ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim()
  )

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
