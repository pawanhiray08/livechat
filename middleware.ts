import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Remove any existing security headers to prevent conflicts
  response.headers.delete('Content-Security-Policy')
  response.headers.delete('Content-Security-Policy-Report-Only')
  response.headers.delete('X-Frame-Options')

  return response
}

// Only run middleware on pages, not on static files
export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
}
