import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTodayPKT } from '@/lib/calculations'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck, Calendar, Clock, AlertTriangle } from 'lucide-react'

async function getAdminDashboardStats() {
  const today = getTodayPKT()

  const [
    totalEmployees,
    presentToday,
    onLeaveToday,
    lateToday,
    pendingLeaves,
  ] = await Promise.all([
    prisma.user.count({
      where: { role: 'EMPLOYEE', isActive: true },
    }),
    prisma.attendance.count({
      where: {
        date: today,
        checkInTime: { not: null },
      },
    }),
    prisma.leave.count({
      where: {
        date: today,
        status: 'APPROVED',
      },
    }),
    prisma.attendance.count({
      where: {
        date: today,
        lateMinutes: { gt: 0 },
      },
    }),
    prisma.leave.count({
      where: {
        status: 'PENDING',
      },
    }),
  ])

  return {
    totalEmployees,
    presentToday,
    onLeaveToday,
    lateToday,
    pendingLeaves,
  }
}

export default async function AdminDashboardPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const stats = await getAdminDashboardStats()

  const statCards = [
    {
      title: 'Total Employees',
      value: stats.totalEmployees,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      title: 'Present Today',
      value: stats.presentToday,
      icon: UserCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      title: 'On Leave Today',
      value: stats.onLeaveToday,
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
    },
    {
      title: 'Late Arrivals',
      value: stats.lateToday,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    },
    {
      title: 'Pending Leaves',
      value: stats.pendingLeaves,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950',
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {session.user.name}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {statCards.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href="/dashboard/admin/employees/new"
                className="block p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="font-medium">Add New Employee</div>
                <div className="text-sm text-muted-foreground">
                  Create a new employee account
                </div>
              </a>
              <a
                href="/dashboard/admin/leaves"
                className="block p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="font-medium">Review Leave Requests</div>
                <div className="text-sm text-muted-foreground">
                  {stats.pendingLeaves} pending requests
                </div>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today's Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Attendance Rate</span>
                  <span className="font-medium">
                    {stats.totalEmployees > 0
                      ? Math.round((stats.presentToday / stats.totalEmployees) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">On Time</span>
                  <span className="font-medium">
                    {stats.presentToday - stats.lateToday}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Absent</span>
                  <span className="font-medium">
                    {stats.totalEmployees - stats.presentToday - stats.onLeaveToday}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
