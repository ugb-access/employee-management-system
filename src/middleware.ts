import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  // NextAuth v5 (Auth.js) changed the session cookie name from
  // "next-auth.session-token" to "authjs.session-token".
  // On HTTPS (production/Vercel) the __Secure- prefix is added.
  const secureCookies = req.nextUrl.protocol === 'https:'
  const cookieName = secureCookies
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  const token = await getToken({
    req,
    // NextAuth v5 reads AUTH_SECRET; fall back to NEXTAUTH_SECRET for compat
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    cookieName,
    salt: cookieName,
  })
  const isLoggedIn = !!token
  const { pathname } = req.nextUrl

  const isOnDashboard = pathname.startsWith('/dashboard')
  const isOnLoginPage = pathname === '/login'

  if (!isLoggedIn && isOnDashboard) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isLoggedIn && isOnLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  if (isLoggedIn && isOnDashboard) {
    const userRole = token.role as string
    const isAdminRoute = pathname.startsWith('/dashboard/admin')

    if (isAdminRoute && userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard/employee', req.url))
    }

    if (pathname === '/dashboard') {
      if (userRole === 'ADMIN') {
        return NextResponse.redirect(new URL('/dashboard/admin', req.url))
      } else {
        return NextResponse.redirect(new URL('/dashboard/employee', req.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
