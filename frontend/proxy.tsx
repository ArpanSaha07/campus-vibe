// ** To restrict access to certain pages based on user login details in the page. **

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const token = request.cookies.get('token')

  const protectedPaths = ['/dashboard']

  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !token) {
    // There is no sign-in page to send them to — auth is a modal. Home carries
    // the request in the query string and AuthModalUrlTrigger opens it there.
    return NextResponse.redirect(new URL('/?auth=login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/create-event/:path*', '/dashboard/:path*']
}