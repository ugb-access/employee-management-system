'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageLoader } from '@/components/ui/loader'
import { DateFilter, DateFilterValue, getCurrentMonthRange } from '@/components/date-filter'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

interface ReportStats {
  totalEmployees: number
  totalAttendance: number
  totalLeaves: number
  totalFines: number
  averageHours: number
  presentToday: number
  absentToday: number
  lateToday: number
}

interface EmployeeReport {
  id: string
  name: string
  employeeId: string | null
  totalDays: number
  presentDays: number
  absentDays: number
  lateDays: number
  totalFines: number
  totalHours: number
  averageHours: number
  leaveCount: number
}

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6']

export default function AdminReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [initialLoading, setInitialLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => getCurrentMonthRange())
  const lastFetchedRef = useRef<string>('')
  const [stats, setStats] = useState<ReportStats | null>(null)
  const [employeeReports, setEmployeeReports] = useState<EmployeeReport[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard/employee')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session && session.user.role === 'ADMIN') {
      const filterKey = `${dateFilter.startDate}_${dateFilter.endDate}`
      if (lastFetchedRef.current !== filterKey) {
        lastFetchedRef.current = filterKey
        fetchReportData()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, dateFilter.startDate, dateFilter.endDate])

  const fetchReportData = useCallback(async () => {
    try {
      const [attendanceRes, employeesRes, leavesRes] = await Promise.all([
        fetch(`/api/attendance?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`),
        fetch('/api/employees'),
        fetch(`/api/leaves?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`),
      ])

      const attendanceData = await attendanceRes.json()
      const employeesData = await employeesRes.json()
      const leavesData = await leavesRes.json()

      if (attendanceRes.ok && employeesRes.ok && leavesRes.ok) {
        const employees = employeesData.employees
        const attendance = attendanceData.attendance
        const allLeaves = leavesData.leaves

        // Filter leaves by selected date range client-side
        const rangeStart = new Date(dateFilter.startDate + 'T00:00:00.000Z')
        const rangeEnd = new Date(dateFilter.endDate + 'T00:00:00.000Z')
        const leaves = allLeaves.filter((l: { date: string }) => {
          const d = new Date(l.date)
          return d >= rangeStart && d <= rangeEnd
        })

        // Calculate overall stats
        const totalFines = attendance.reduce(
          (sum: number, a: { fineAmount: number }) => sum + a.fineAmount,
          0
        )
        const totalHours = attendance.reduce(
          (sum: number, a: { totalHours: number }) => sum + (a.totalHours || 0),
          0
        )
        const averageHours = attendance.length > 0 ? totalHours / attendance.length : 0

        // Today's stats - compare UTC date parts
        const today = new Date()
        const todayAttendance = attendance.filter(
          (a: { date: string }) => {
            const d = new Date(a.date)
            return d.getUTCFullYear() === today.getUTCFullYear() &&
                   d.getUTCMonth() === today.getUTCMonth() &&
                   d.getUTCDate() === today.getUTCDate()
          }
        )
        const presentToday = todayAttendance.length
        const absentToday = employees.length - presentToday
        const lateToday = todayAttendance.filter(
          (a: { lateMinutes: number }) => a.lateMinutes > 0
        ).length

        setStats({
          totalEmployees: employees.length,
          totalAttendance: attendance.length,
          totalLeaves: leaves.filter(
            (l: { status: string }) => l.status === 'APPROVED'
          ).length,
          totalFines,
          averageHours,
          presentToday,
          absentToday,
          lateToday,
        })

        // Calculate working days in selected date range (Mon–Fri)
        let workingDayCount = 0
        for (let d = new Date(rangeStart); d <= rangeEnd; d.setUTCDate(d.getUTCDate() + 1)) {
          const dayOfWeek = d.getUTCDay()
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            workingDayCount++
          }
        }

        // Calculate per-employee stats
        const reports: EmployeeReport[] = employees.map(
          (emp: { id: string; name: string; employeeId: string | null }) => {
            const empAttendance = attendance.filter(
              (a: { userId: string }) => a.userId === emp.id
            )
            const empLeaves = leaves.filter(
              (l: { userId: string; status: string }) =>
                l.userId === emp.id && l.status === 'APPROVED'
            )

            const presentDays = empAttendance.length
            const lateDays = empAttendance.filter(
              (a: { lateMinutes: number }) => a.lateMinutes > 0
            ).length
            const empTotalFines = empAttendance.reduce(
              (sum: number, a: { fineAmount: number }) => sum + a.fineAmount,
              0
            )
            const empTotalHours = empAttendance.reduce(
              (sum: number, a: { totalHours: number }) => sum + (a.totalHours || 0),
              0
            )
            const empAvgHours = presentDays > 0 ? empTotalHours / presentDays : 0

            const totalDays = workingDayCount
            const absentDays = totalDays - presentDays - empLeaves.length

            return {
              id: emp.id,
              name: emp.name,
              employeeId: emp.employeeId,
              totalDays,
              presentDays,
              absentDays: Math.max(0, absentDays),
              lateDays,
              totalFines: empTotalFines,
              totalHours: empTotalHours,
              averageHours: empAvgHours,
              leaveCount: empLeaves.length,
            }
          }
        )

        setEmployeeReports(reports)
      }
    } catch (error) {
      console.error('Failed to fetch report data:', error)
    } finally {
      setInitialLoading(false)
    }
  }, [dateFilter.startDate, dateFilter.endDate])

  // Chart data
  const attendanceChartData = employeeReports.slice(0, 10).map((emp) => ({
    name: emp.name?.split(' ')[0] || 'Unknown',
    present: emp.presentDays,
    late: emp.lateDays,
  }))

  const pieData = stats
    ? [
        { name: 'Present', value: stats.presentToday },
        { name: 'Absent', value: stats.absentToday },
        { name: 'Late', value: stats.lateToday },
      ]
    : []

  if (status === 'loading' || initialLoading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading reports..." />
      </DashboardLayout>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              View attendance and leave statistics
            </p>
          </div>
          <DateFilter
            modes={['month', 'range']}
            monthCount={12}
            onChange={setDateFilter}
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Employees</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats?.totalEmployees || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Fines</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                Rs.{stats?.totalFines || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg. Work Hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats?.averageHours.toFixed(1) || 0}h
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Approved Leaves</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats?.totalLeaves || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Overview</CardTitle>
              <CardDescription>Present vs Late days by employee</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="present" fill="#22c55e" name="Present" />
                    <Bar dataKey="late" fill="#f59e0b" name="Late" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Status</CardTitle>
              <CardDescription>Attendance breakdown for today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employee Report Table */}
        <Card>
          <CardHeader>
            <CardTitle>Employee Performance Report</CardTitle>
            <CardDescription>
              Detailed attendance and leave statistics per employee
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-center">Working Days</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-center">Leaves</TableHead>
                  <TableHead className="text-center">Avg Hours</TableHead>
                  <TableHead className="text-center">Total Fines</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{report.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.employeeId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {report.totalDays}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-green-500">
                        {report.presentDays}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          report.absentDays > 3 ? 'destructive' : 'secondary'
                        }
                      >
                        {report.absentDays}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          report.lateDays > 3 ? 'destructive' : 'secondary'
                        }
                      >
                        {report.lateDays}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {report.leaveCount}
                    </TableCell>
                    <TableCell className="text-center">
                      {report.averageHours.toFixed(1)}h
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={
                          report.totalFines > 0 ? 'text-red-500 font-medium' : ''
                        }
                      >
                        Rs.{report.totalFines}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
