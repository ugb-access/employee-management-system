import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
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
