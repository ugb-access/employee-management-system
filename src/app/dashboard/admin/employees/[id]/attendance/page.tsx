'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard-layout'
import { DateFilter, DateFilterValue, getCurrentMonthRange } from '@/components/date-filter'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Download,
  Clock,
  CalendarDays,
  AlertTriangle,
  DollarSign,
  Timer,
  CalendarOff,
  UserX,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { exportToCSV, formatDateForExport, formatTimeForExport } from '@/lib/export'
import { formatTime, computeAbsentDays } from '@/lib/calculations'
import { toast } from 'sonner'
import { PageLoader } from '@/components/ui/loader'

const PAGE_SIZE = 10

interface EmployeeSettings {
  checkInTime: string | null
  checkOutTime: string | null
  requiredWorkHours: number | null
}

interface Employee {
  id: string
  email: string
  name: string | null
  designation: string | null
  employeeId: string | null
  isActive: boolean
  settings: EmployeeSettings | null
}

interface Attendance {
  id: string
  date: string
  checkInTime: string | null
  checkOutTime: string | null
  checkInReason: string | null
  checkOutReason: string | null
  lateMinutes: number
  earlyMinutes: number
  totalHours: number | null
  fineAmount: number
  isAutoLeave: boolean
  isModifiedByAdmin: boolean
}

interface Leave {
  id: string
  date: string
  reason: string
  leaveType: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  isPaid: boolean
  createdAt: string
  approver: { id: string; name: string } | null
}

interface OffDay {
  id: string
  date: string
  reason: string | null
  isPaid: boolean
}

interface Holiday { id: string; date: string }

interface GlobalSettings {
  checkInTime: string
  checkOutTime: string
  requiredWorkHours: number
  workingDays: string
  leaveCost: number
}

type TimelineRow =
  | { kind: 'attendance'; data: Attendance }
  | { kind: 'leave'; data: Leave }
  | { kind: 'absent'; date: string }

export default function EmployeeAttendancePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const employeeId = params.id as string

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [offDays, setOffDays] = useState<OffDay[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => getCurrentMonthRange())
  const [currentPage, setCurrentPage] = useState(1)

  const lastFetchedRef = useRef<string>('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard/employee')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session && session.user.role === 'ADMIN' && employeeId) {
      fetchEmployee()
      fetchLeaves()
      fetchOffDays()
      fetchGlobalSettings()
      fetchHolidays()
    }
  }, [session, employeeId])

  useEffect(() => {
    if (session && session.user.role === 'ADMIN' && employeeId) {
      const filterKey = `${dateFilter.startDate}_${dateFilter.endDate}`
      if (lastFetchedRef.current !== filterKey) {
        lastFetchedRef.current = filterKey
        setCurrentPage(1)
        fetchAttendance()
      }
    }
  }, [session, employeeId, dateFilter.startDate, dateFilter.endDate])

  const fetchEmployee = async () => {
    try {
      const response = await fetch(`/api/employees/${employeeId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch employee')
      setEmployee(data.employee)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch employee')
    }
  }

  const fetchAttendance = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/attendance?userId=${employeeId}&startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch attendance')
      setAttendance(data.attendance)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch attendance')
    } finally {
      setInitialLoading(false)
    }
  }, [employeeId, dateFilter.startDate, dateFilter.endDate])

  const fetchLeaves = async () => {
    try {
      const response = await fetch(`/api/leaves?userId=${employeeId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch leaves')
      setLeaves(data.leaves)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch leaves')
    }
  }

  const fetchOffDays = async () => {
    try {
      const response = await fetch(`/api/off-days?userId=${employeeId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch off days')
      setOffDays(data.offDays)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch off days')
    }
  }

  const fetchHolidays = async () => {
    try {
      const response = await fetch('/api/holidays')
      const data = await response.json()
      if (response.ok) setHolidays(data.holidays || [])
    } catch {
      // non-critical
    }
  }

  const fetchGlobalSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      const data = await response.json()
      if (response.ok) setGlobalSettings(data.settings)
    } catch {
      // Non-critical, silently fail
    }
  }

  const formatHours = (hours: number | null) => hours ? `${hours.toFixed(1)}h` : '-'

  // Filter leaves and off-days by the current date range
  const rangeStart = new Date(dateFilter.startDate + 'T00:00:00.000Z')
  const rangeEnd = new Date(dateFilter.endDate + 'T00:00:00.000Z')

  const filteredLeaves = leaves.filter((l) => {
    const d = new Date(l.date)
    return l.status === 'APPROVED' && d >= rangeStart && d <= rangeEnd
  })

  // Compute absent days for the range
  const workingDays = globalSettings?.workingDays
    ? globalSettings.workingDays.split(',').map(Number)
    : [1, 2, 3, 4, 5]

  const holidayDates = holidays
    .filter((h) => {
      const d = new Date(h.date)
      return d >= rangeStart && d <= rangeEnd
    })
    .map((h) => new Date(h.date))

  const absentDays = computeAbsentDays(
    rangeStart,
    rangeEnd,
    workingDays,
    attendance.map(a => new Date(a.date)),
    filteredLeaves.map(l => new Date(l.date)),
    offDays.filter(o => {
      const d = new Date(o.date)
      return d >= rangeStart && d <= rangeEnd
    }).map(o => new Date(o.date)),
    holidayDates
  )

  // Build unified timeline
  const timeline: TimelineRow[] = [
    ...attendance.map(a => ({ kind: 'attendance' as const, data: a })),
    ...filteredLeaves.map(l => ({ kind: 'leave' as const, data: l })),
    ...absentDays.map(d => ({ kind: 'absent' as const, date: d.toISOString() })),
  ]
  const getRowDate = (row: TimelineRow) =>
    row.kind === 'attendance' ? row.data.date :
    row.kind === 'leave' ? row.data.date : row.date
  timeline.sort((a, b) => new Date(getRowDate(b)).getTime() - new Date(getRowDate(a)).getTime())

  // Stats
  const leaveCost = globalSettings?.leaveCost || 0
  const lateFine = attendance.reduce((sum, r) => sum + r.fineAmount, 0)
  const absenceFine = absentDays.length * leaveCost
  const totalFine = lateFine + absenceFine

  const stats = {
    totalDays: timeline.length,
    lateDays: attendance.filter((r) => r.lateMinutes > 0).length,
    earlyDays: attendance.filter((r) => r.earlyMinutes > 0).length,
    totalHours: attendance.reduce((sum, r) => sum + (r.totalHours || 0), 0),
    lateFine,
    absenceFine,
    totalFine,
    leavesCount: filteredLeaves.length,
  }

  // Pagination for timeline
  const totalPages = Math.ceil(timeline.length / PAGE_SIZE)
  const paginatedTimeline = timeline.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageStart = (currentPage - 1) * PAGE_SIZE

  const getStatusBadge = (row: TimelineRow) => {
    if (row.kind === 'absent') return <Badge variant="destructive" className="text-xs">Absent</Badge>
    if (row.kind === 'leave') {
      return row.data.isPaid
        ? <Badge className="bg-blue-500 text-xs">On Leave · Paid</Badge>
        : <Badge className="bg-indigo-500 text-xs">On Leave · Unpaid</Badge>
    }
    const badges = []
    if (row.data.isAutoLeave) badges.push(<Badge key="al" variant="outline" className="text-xs">Auto Leave</Badge>)
    if (row.data.isModifiedByAdmin) badges.push(<Badge key="mod" variant="secondary" className="text-xs">Modified</Badge>)
    if (!row.data.isAutoLeave && !row.data.isModifiedByAdmin) {
      if (row.data.lateMinutes > 0) badges.push(<Badge key="late" className="bg-orange-500 text-xs">Present · Late</Badge>)
      else badges.push(<Badge key="pres" className="bg-green-500 text-xs">Present</Badge>)
    }
    return <div className="flex flex-col gap-1">{badges}</div>
  }

  const handleExport = () => {
    if (attendance.length === 0) {
      toast.error('No attendance data to export')
      return
    }

    const data = attendance.map((record) => ({
      date: formatDateForExport(record.date),
      checkIn: formatTimeForExport(record.checkInTime),
      checkOut: formatTimeForExport(record.checkOutTime),
      totalHours: record.totalHours?.toFixed(2) || '0',
      lateMinutes: record.lateMinutes,
      earlyMinutes: record.earlyMinutes,
      fineAmount: record.fineAmount,
      status: record.isAutoLeave ? 'Auto Leave' : 'Present',
      checkInReason: record.checkInReason || '',
      checkOutReason: record.checkOutReason || '',
    }))

    exportToCSV(
      data,
      [
        { header: 'Date', accessor: 'date' },
        { header: 'Check In', accessor: 'checkIn' },
        { header: 'Check Out', accessor: 'checkOut' },
        { header: 'Total Hours', accessor: 'totalHours' },
        { header: 'Late (min)', accessor: 'lateMinutes' },
        { header: 'Early (min)', accessor: 'earlyMinutes' },
        { header: 'Fine (Rs.)', accessor: 'fineAmount' },
        { header: 'Status', accessor: 'status' },
        { header: 'Check In Reason', accessor: 'checkInReason' },
        { header: 'Check Out Reason', accessor: 'checkOutReason' },
      ],
      `${employee?.name || 'employee'}-attendance-${dateFilter.startDate}-to-${dateFilter.endDate}`
    )

    toast.success('Attendance exported successfully')
  }

  const getEffectiveSettings = () => {
    const custom = employee?.settings
    return {
      checkInTime: custom?.checkInTime || globalSettings?.checkInTime || '09:00',
      checkOutTime: custom?.checkOutTime || globalSettings?.checkOutTime || '17:00',
      requiredWorkHours: custom?.requiredWorkHours || globalSettings?.requiredWorkHours || 8,
      isCustom: !!(custom?.checkInTime || custom?.checkOutTime || custom?.requiredWorkHours),
    }
  }

  if (status === 'loading' || initialLoading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading attendance details..." />
      </DashboardLayout>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  if (!employee) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Link href="/dashboard/admin/employees">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Employees
            </Button>
          </Link>
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">
            Employee not found
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const effective = getEffectiveSettings()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/admin/employees/${employee.id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{employee.name}</h1>
                <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                  {employee.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {employee.designation}
                {employee.employeeId && ` - ${employee.employeeId}`}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={attendance.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Settings Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Work Schedule
            </CardTitle>
            <CardDescription>
              {effective.isCustom
                ? 'This employee has custom schedule settings'
                : 'Using global schedule settings'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  {effective.isCustom ? (
                    <Badge variant="default">Custom</Badge>
                  ) : (
                    <Badge variant="secondary">Global</Badge>
                  )}
                  Effective Settings
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-in Time</span>
                    <span className="font-medium">{effective.checkInTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-out Time</span>
                    <span className="font-medium">{effective.checkOutTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Required Hours</span>
                    <span className="font-medium">{effective.requiredWorkHours}h</span>
                  </div>
                </div>
              </div>

              {effective.isCustom && globalSettings && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="outline">Global</Badge>
                    Global Settings (for reference)
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-in Time</span>
                      <span className="font-medium">{globalSettings.checkInTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-out Time</span>
                      <span className="font-medium">{globalSettings.checkOutTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Required Hours</span>
                      <span className="font-medium">{globalSettings.requiredWorkHours}h</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Date Filter */}
        <DateFilter modes={['month', 'range']} monthCount={12} onChange={setDateFilter} />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Total Days</p>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.totalDays}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <p className="text-sm text-muted-foreground">Late Days</p>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.lateDays}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-yellow-500" />
                <p className="text-sm text-muted-foreground">Early Days</p>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.earlyDays}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <p className="text-sm text-muted-foreground">Total Hours</p>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.totalHours.toFixed(1)}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-500" />
                <p className="text-sm text-muted-foreground">Late Fine</p>
              </div>
              <p className="text-2xl font-bold mt-1 text-orange-500">Rs.{stats.lateFine}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-500" />
                <p className="text-sm text-muted-foreground">Absence Fine</p>
              </div>
              <p className="text-2xl font-bold mt-1 text-red-500">Rs.{stats.absenceFine}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-red-700" />
                <p className="text-sm text-muted-foreground">Total Fine</p>
              </div>
              <p className="text-2xl font-bold mt-1 text-red-700">Rs.{stats.totalFine}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-purple-500" />
                <p className="text-sm text-muted-foreground">Leaves (period)</p>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.leavesCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Attendance Timeline | Leaves | Off Days */}
        <Tabs defaultValue="attendance">
          <TabsList>
            <TabsTrigger value="attendance">
              Timeline ({timeline.length})
            </TabsTrigger>
            <TabsTrigger value="leaves">
              Leaves ({leaves.length})
            </TabsTrigger>
            <TabsTrigger value="offdays">
              Off Days ({offDays.length})
            </TabsTrigger>
          </TabsList>

          {/* Attendance Timeline Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Timeline</CardTitle>
                <CardDescription>
                  {new Date(dateFilter.startDate).toLocaleDateString()} —{' '}
                  {new Date(dateFilter.endDate).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No records found for the selected period.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Check In</TableHead>
                            <TableHead>Check Out</TableHead>
                            <TableHead>Hours</TableHead>
                            <TableHead>Late (min)</TableHead>
                            <TableHead>Early (min)</TableHead>
                            <TableHead>Fine</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedTimeline.map((row) => (
                            <TableRow
                              key={
                                row.kind === 'attendance' ? `att-${row.data.id}` :
                                row.kind === 'leave' ? `leave-${row.data.id}` :
                                `absent-${row.date}`
                              }
                            >
                              <TableCell>
                                {new Date(getRowDate(row)).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </TableCell>
                              <TableCell>
                                {row.kind === 'attendance' ? (
                                  <div>
                                    <p>{formatTime(row.data.checkInTime)}</p>
                                    {row.data.checkInReason && (
                                      <p className="text-xs text-muted-foreground truncate max-w-32">
                                        {row.data.checkInReason}
                                      </p>
                                    )}
                                  </div>
                                ) : '—'}
                              </TableCell>
                              <TableCell>
                                {row.kind === 'attendance' ? (
                                  <div>
                                    <p>{formatTime(row.data.checkOutTime)}</p>
                                    {row.data.checkOutReason && (
                                      <p className="text-xs text-muted-foreground truncate max-w-32">
                                        {row.data.checkOutReason}
                                      </p>
                                    )}
                                  </div>
                                ) : '—'}
                              </TableCell>
                              <TableCell>
                                {row.kind === 'attendance' ? formatHours(row.data.totalHours) : '—'}
                              </TableCell>
                              <TableCell>
                                {row.kind === 'attendance'
                                  ? row.data.lateMinutes > 0
                                    ? <span className="text-orange-500">{row.data.lateMinutes}</span>
                                    : '0'
                                  : '—'}
                              </TableCell>
                              <TableCell>
                                {row.kind === 'attendance'
                                  ? row.data.earlyMinutes > 0
                                    ? <span className="text-yellow-500">{row.data.earlyMinutes}</span>
                                    : '0'
                                  : '—'}
                              </TableCell>
                              <TableCell>
                                {row.kind === 'attendance'
                                  ? row.data.fineAmount > 0
                                    ? <span className="text-red-500">Rs.{row.data.fineAmount}</span>
                                    : 'Rs.0'
                                  : '—'}
                              </TableCell>
                              <TableCell>{getStatusBadge(row)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {timeline.length > PAGE_SIZE && (
                      <div className="flex items-center justify-between pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, timeline.length)} of {timeline.length} records
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => p - 1)}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          <span className="text-sm font-medium">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage === totalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leaves Tab */}
          <TabsContent value="leaves">
            <Card>
              <CardHeader>
                <CardTitle>Leave Requests</CardTitle>
                <CardDescription>All leave requests for this employee</CardDescription>
              </CardHeader>
              <CardContent>
                {leaves.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No leave requests found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Approved By</TableHead>
                          <TableHead>Requested On</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaves.map((leave) => (
                          <TableRow key={leave.id}>
                            <TableCell>
                              {new Date(leave.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{leave.leaveType}</Badge>
                            </TableCell>
                            <TableCell>
                              <p className="truncate max-w-48">{leave.reason}</p>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  leave.status === 'APPROVED'
                                    ? 'default'
                                    : leave.status === 'REJECTED'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                              >
                                {leave.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {leave.approver?.name || '-'}
                            </TableCell>
                            <TableCell>
                              {new Date(leave.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Off Days Tab */}
          <TabsContent value="offdays">
            <Card>
              <CardHeader>
                <CardTitle>Off Days</CardTitle>
                <CardDescription>All off days for this employee</CardDescription>
              </CardHeader>
              <CardContent>
                {offDays.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No off days found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {offDays.map((offDay) => (
                          <TableRow key={offDay.id}>
                            <TableCell>
                              {new Date(offDay.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </TableCell>
                            <TableCell>
                              <p className="truncate max-w-64">{offDay.reason || '-'}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant={offDay.isPaid ? 'default' : 'secondary'}>
                                {offDay.isPaid ? 'Paid' : 'Unpaid'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
