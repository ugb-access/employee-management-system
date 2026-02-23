import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isOnDashboard = req.nextUrl.pathname.startsWith('/dashboard')
  const isOnLoginPage = req.nextUrl.pathname === '/login'

  if (!isLoggedIn && isOnDashboard) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isLoggedIn && isOnLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Role-based access control
  if (isLoggedIn && isOnDashboard) {
    const userRole = req.auth?.user?.role
    const isAdminRoute = req.nextUrl.pathname.startsWith('/dashboard/admin')
    const isEmployeeRoute = req.nextUrl.pathname.startsWith('/dashboard/employee')

    if (isAdminRoute && userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard/employee', req.url))
    }

    if (isEmployeeRoute && userRole === 'ADMIN') {
      // Admin can access employee routes but let's redirect them to admin dashboard
      // Remove this if you want admins to be able to view employee dashboard
    }

    // Redirect to appropriate dashboard based on role
    if (req.nextUrl.pathname === '/dashboard') {
      if (userRole === 'ADMIN') {
        return NextResponse.redirect(new URL('/dashboard/admin', req.url))
      } else {
        return NextResponse.redirect(new URL('/dashboard/employee', req.url))
      }
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
