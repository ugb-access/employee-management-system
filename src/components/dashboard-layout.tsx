'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useInstallPrompt } from '@/components/pwa'
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  User,
  CalendarDays,
  FileText,
  Moon,
  Sun,
  Monitor,
  Menu,
  X,
  Download
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const navigation = {
  ADMIN: [
    { name: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
    { name: 'Employees', href: '/dashboard/admin/employees', icon: Users },
    { name: 'Attendance', href: '/dashboard/admin/attendance', icon: Clock },
    { name: 'Leaves', href: '/dashboard/admin/leaves', icon: Calendar },
    { name: 'Off Days', href: '/dashboard/admin/off-days', icon: CalendarDays },
    { name: 'Reports', href: '/dashboard/admin/reports', icon: BarChart3 },
    { name: 'Terms & Policies', href: '/dashboard/admin/terms', icon: FileText },
    { name: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
    { name: 'Profile', href: '/dashboard/admin/profile', icon: User },
  ],
  EMPLOYEE: [
    { name: 'Dashboard', href: '/dashboard/employee', icon: LayoutDashboard },
    { name: 'My Attendance', href: '/dashboard/employee/attendance', icon: Clock },
    { name: 'My Leaves', href: '/dashboard/employee/leaves', icon: Calendar },
    { name: 'Terms & Policies', href: '/dashboard/employee/terms', icon: FileText },
    { name: 'Profile', href: '/dashboard/employee/profile', icon: User },
  ],
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { canInstall, install } = useInstallPrompt()
  const userRole = session?.user?.role || 'EMPLOYEE'
  const navItems = navigation[userRole as keyof typeof navigation]

  useEffect(() => {
    setMounted(true)
  }, [])

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card px-4 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Image src="/icon.svg" alt="EMS Logo" width={28} height={28} className="h-7 w-7" />
        <span className="text-lg font-bold text-primary">EMS</span>
      </header>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b px-6">
            <div className="flex items-center gap-2">
              <Image
                src="/icon.svg"
                alt="EMS Logo"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-primary leading-tight">EMS</h1>
                <span className="text-xs text-muted-foreground">
                  {userRole === 'ADMIN' ? 'Admin Dashboard' : 'Employee Portal'}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User menu */}
          <div className="border-t p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 px-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(session?.user?.name || null)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm">
                    <span className="font-medium">{session?.user?.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {session?.user?.designation || session?.user?.role}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {mounted && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setTheme('light')}>
                      <Sun className="mr-2 h-4 w-4" />
                      Light
                      {theme === 'light' && <span className="ml-auto">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('dark')}>
                      <Moon className="mr-2 h-4 w-4" />
                      Dark
                      {theme === 'dark' && <span className="ml-auto">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('system')}>
                      <Monitor className="mr-2 h-4 w-4" />
                      System
                      {theme === 'system' && <span className="ml-auto">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {canInstall && (
                  <>
                    <DropdownMenuItem onClick={install}>
                      <Download className="mr-2 h-4 w-4" />
                      Install app
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
