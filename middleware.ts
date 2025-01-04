import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Remove any existing security headers to prevent conflicts
  response.headers.delete('Content-Security-Policy')
  response.headers.delete('Content-Security-Policy-Report-Only')

  // Add security headers
  const ContentSecurityPolicy = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.firebaseapp.com https://*.firebase.com https://*.googleapis.com https://*.google.com https://*.gstatic.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' blob: data: https://*.googleusercontent.com;
    frame-src 'self' https://*.firebaseapp.com https://*.firebase.com;
    connect-src 'self' 
      https://*.firebaseapp.com 
      https://*.firebase.com 
      wss://*.firebaseio.com 
      https://*.googleapis.com 
      https://*.google.com
      https://*.vercel.app;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;
  `

  response.headers.set(
    'Content-Security-Policy',
    ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim()
  )

  return response
}

// Only run middleware on pages, not on static files
export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
}
