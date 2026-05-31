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
  Label,
} from 'recharts'
import { computeAbsentDays, isSameCalendarDate } from '@/lib/calculations'

interface ReportStats {
  totalEmployees: number
  totalLeaves: number
  totalLateFines: number
  totalAbsenceFines: number
  grandTotalFines: number
}

interface EmployeeReport {
  id: string
  name: string
  employeeId: string | null
  presentDays: number
  onTimeDays: number
  lateDays: number
  absentDays: number
  leaveCount: number
  totalHours: number
  lateFine: number
  absenceFine: number
  totalFine: number
}

const BAR_COLORS = {
  onTime: '#22c55e',
  late: '#f59e0b',
  leave: '#3b82f6',
  absent: '#ef4444',
}
const FINE_COLORS = ['#f59e0b', '#ef4444']

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
      const currentYear = new Date().getUTCFullYear()
      const [attendanceRes, employeesRes, leavesRes, settingsRes, holidaysRes, yearLeavesRes] = await Promise.all([
        fetch(`/api/attendance?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`),
        fetch('/api/employees?all=true'),
        fetch(`/api/leaves?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`),
        fetch('/api/settings'),
        fetch('/api/holidays'),
        fetch(`/api/leaves?status=APPROVED&startDate=${currentYear}-01-01&endDate=${currentYear}-12-31`),
      ])

      const attendanceData = await attendanceRes.json()
      const employeesData = await employeesRes.json()
      const leavesData = await leavesRes.json()
      const settingsData = settingsRes.ok ? await settingsRes.json() : null
      const holidaysData = holidaysRes.ok ? await holidaysRes.json() : null
      const yearLeavesData = yearLeavesRes.ok ? await yearLeavesRes.json() : null
      const allYearLeaves: { userId: string; status: string }[] = yearLeavesData?.leaves || []

      if (attendanceRes.ok && employeesRes.ok && leavesRes.ok) {
        const employees = employeesData.employees
        const attendance = attendanceData.attendance
        const allLeaves = leavesData.leaves

        const approvedLeaves = allLeaves.filter((l: { status: string }) => l.status === 'APPROVED')

        const rangeStart = new Date(dateFilter.startDate + 'T00:00:00.000Z')
        const rangeEnd = new Date(dateFilter.endDate + 'T00:00:00.000Z')

        // Parse working days and holidays from settings
        const workingDays: number[] = settingsData?.settings?.workingDays
          ? settingsData.settings.workingDays.split(',').map(Number)
          : [1, 2, 3, 4, 5]
        const leaveCost: number = settingsData?.settings?.leaveCost || 0
        const annualPool: number = settingsData?.settings?.annualLeavesPerYear ?? 12

        const allHolidays: { date: string }[] = holidaysData?.holidays || []
        const holidayDates = allHolidays
          .filter((h) => {
            const d = new Date(h.date)
            return d >= rangeStart && d <= rangeEnd
          })
          .map((h) => new Date(h.date))

        // Calculate working days in range (using configured workingDays, minus holidays)
        let workingDayCount = 0
        for (let d = new Date(rangeStart); d.getTime() <= rangeEnd.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
          const utcDay = d.getUTCDay()
          const isoWeekday = utcDay === 0 ? 7 : utcDay
          if (workingDays.includes(isoWeekday) && !holidayDates.some(h => isSameCalendarDate(h, d))) {
            workingDayCount++
          }
        }

        // Per-employee reports
        const reports: EmployeeReport[] = employees.map(
          (emp: { id: string; name: string; employeeId: string | null }) => {
            const empAttendance = attendance.filter(
              (a: { userId: string }) => a.userId === emp.id
            )
            const empLeaves = approvedLeaves.filter(
              (l: { userId: string }) => l.userId === emp.id
            )

            const presentDays = empAttendance.length
            const lateDays = empAttendance.filter(
              (a: { lateMinutes: number }) => a.lateMinutes > 0
            ).length
            const onTimeDays = presentDays - lateDays
            const empTotalHours = empAttendance.reduce(
              (sum: number, a: { totalHours: number }) => sum + (a.totalHours || 0),
              0
            )
            const lateFine = empAttendance.reduce(
              (sum: number, a: { fineAmount: number }) => sum + a.fineAmount,
              0
            )

            const empAbsentDays = computeAbsentDays(
              rangeStart,
              rangeEnd,
              workingDays,
              empAttendance.map((a: { date: string }) => new Date(a.date)),
              empLeaves.map((l: { date: string }) => new Date(l.date)),
              [],
              holidayDates
            )
            const absentDays = empAbsentDays.length
            const empYearLeavesUsed = allYearLeaves.filter(l => l.userId === emp.id).length
            const annualRemaining = Math.max(0, annualPool - empYearLeavesUsed)
            const fineWorthyAbsences = Math.max(0, absentDays - annualRemaining)
            const absenceFine = fineWorthyAbsences * leaveCost
            const totalFine = lateFine + absenceFine

            return {
              id: emp.id,
              name: emp.name,
              employeeId: emp.employeeId,
              presentDays,
              onTimeDays,
              lateDays,
              absentDays,
              leaveCount: empLeaves.length,
              totalHours: empTotalHours,
              lateFine,
              absenceFine,
              totalFine,
            }
          }
        )

        const totalLateFines = reports.reduce((sum, r) => sum + r.lateFine, 0)
        const totalAbsenceFines = reports.reduce((sum, r) => sum + r.absenceFine, 0)

        setStats({
          totalEmployees: employees.length,
          totalLeaves: approvedLeaves.length,
          totalLateFines,
          totalAbsenceFines,
          grandTotalFines: totalLateFines + totalAbsenceFines,
        })

        setEmployeeReports(reports)
      }
    } catch (error) {
      console.error('Failed to fetch report data:', error)
    } finally {
      setInitialLoading(false)
    }
  }, [dateFilter.startDate, dateFilter.endDate])

  // Chart data — top 8 employees by present days
  const barChartData = employeeReports
    .slice()
    .sort((a, b) => b.presentDays - a.presentDays)
    .slice(0, 8)
    .map((emp) => ({
      name: emp.name?.split(' ')[0] || 'Unknown',
      onTime: emp.onTimeDays,
      late: emp.lateDays,
      leave: emp.leaveCount,
      absent: emp.absentDays,
    }))

  const grandTotal = stats?.grandTotalFines || 0
  const fineData = [
    { name: 'Late Fine', value: stats?.totalLateFines || 0 },
    { name: 'Absence Fine', value: stats?.totalAbsenceFines || 0 },
  ].filter(d => d.value > 0)

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
              <CardDescription>Late Fines</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">
                Rs.{stats?.totalLateFines || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Absence Fines</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                Rs.{stats?.totalAbsenceFines || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Grand Total Fines</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-700">
                Rs.{stats?.grandTotalFines || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stacked bar: present/late/leave/absent per employee */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Breakdown</CardTitle>
              <CardDescription>Top 8 employees — on time, late, leave, absent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="onTime" stackId="a" fill={BAR_COLORS.onTime} name="On Time" />
                    <Bar dataKey="late" stackId="a" fill={BAR_COLORS.late} name="Late" />
                    <Bar dataKey="leave" stackId="a" fill={BAR_COLORS.leave} name="On Leave" />
                    <Bar dataKey="absent" stackId="a" fill={BAR_COLORS.absent} name="Absent" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Donut: fine distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Fine Distribution</CardTitle>
              <CardDescription>Late fines vs. absence fines for the period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {fineData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No fines for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fineData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                      >
                        <Label
                          value={`Rs.${grandTotal}`}
                          position="center"
                          className="text-sm font-bold"
                        />
                        {fineData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={FINE_COLORS[index % FINE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `Rs.${value}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employee Report Table */}
        <Card>
          <CardHeader>
            <CardTitle>Employee Performance Report</CardTitle>
            <CardDescription>
              Attendance, leave, and fine details per employee
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-center">Leaves</TableHead>
                  <TableHead className="text-center">Late Fine</TableHead>
                  <TableHead className="text-center">Absence Fine</TableHead>
                  <TableHead className="text-center">Total Fine</TableHead>
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
                      <Badge className="bg-green-500">{report.presentDays}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={report.absentDays > 3 ? 'destructive' : 'secondary'}>
                        {report.absentDays}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={report.lateDays > 3 ? 'destructive' : 'secondary'}>
                        {report.lateDays}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{report.leaveCount}</TableCell>
                    <TableCell className="text-center">
                      <span className={report.lateFine > 0 ? 'text-orange-500 font-medium' : ''}>
                        Rs.{report.lateFine}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={report.absenceFine > 0 ? 'text-red-500 font-medium' : ''}>
                        Rs.{report.absenceFine}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={report.totalFine > 0 ? 'text-red-700 font-bold' : ''}>
                        Rs.{report.totalFine}
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
