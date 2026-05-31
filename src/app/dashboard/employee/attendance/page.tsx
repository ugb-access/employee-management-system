'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
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
import { Calendar, Clock, TrendingUp, AlertTriangle, ChevronLeft, ChevronRight, UserX } from 'lucide-react'
import { PageLoader } from '@/components/ui/loader'
import { DateFilter, DateFilterValue, getCurrentMonthRange } from '@/components/date-filter'
import { formatTime, computeAbsentDays } from '@/lib/calculations'
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 10

interface Attendance {
  id: string
  date: string
  checkInTime: string | null
  checkOutTime: string | null
  lateMinutes: number
  earlyMinutes: number
  totalHours: number | null
  fineAmount: number
  isAutoLeave: boolean
}

interface Leave {
  id: string
  date: string
  leaveType: 'PAID' | 'UNPAID' | 'SICK' | 'CASUAL'
  isPaid: boolean
  reason: string
}

interface OffDay { id: string; date: string }
interface Holiday { id: string; date: string }

type TimelineRow =
  | { kind: 'attendance'; data: Attendance }
  | { kind: 'leave'; data: Leave }
  | { kind: 'absent'; date: string }

export default function EmployeeAttendancePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [initialLoading, setInitialLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => getCurrentMonthRange())
  const [currentPage, setCurrentPage] = useState(1)
  const lastFetchedRef = useRef<string>('')

  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [offDays, setOffDays] = useState<OffDay[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [leaveCost, setLeaveCost] = useState(0)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // One-time static data fetch (settings, holidays, off-days)
  useEffect(() => {
    if (session) {
      Promise.all([
        fetch('/api/off-days').then(r => r.ok ? r.json() : null),
        fetch('/api/holidays').then(r => r.ok ? r.json() : null),
        fetch('/api/settings').then(r => r.ok ? r.json() : null),
      ]).then(([offDaysData, holidaysData, settingsData]) => {
        if (offDaysData) setOffDays(offDaysData.offDays || [])
        if (holidaysData) setHolidays(holidaysData.holidays || [])
        if (settingsData?.settings) {
          setWorkingDays(settingsData.settings.workingDays.split(',').map(Number))
          setLeaveCost(settingsData.settings.leaveCost || 0)
        }
      }).catch(console.error)
    }
  }, [session])

  // Date-range dependent fetches (attendance, leaves)
  const fetchDynamicData = useCallback(async () => {
    try {
      const [attendanceRes, leavesRes] = await Promise.all([
        fetch(`/api/attendance?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`),
        fetch(`/api/leaves?status=APPROVED&startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`),
      ])
      if (attendanceRes.ok) {
        const data = await attendanceRes.json()
        setAttendance(data.attendance)
      }
      if (leavesRes.ok) {
        const data = await leavesRes.json()
        setLeaves(data.leaves)
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error)
    } finally {
      setInitialLoading(false)
    }
  }, [dateFilter.startDate, dateFilter.endDate])

  useEffect(() => {
    if (session) {
      const filterKey = `${dateFilter.startDate}_${dateFilter.endDate}`
      if (lastFetchedRef.current !== filterKey) {
        lastFetchedRef.current = filterKey
        fetchDynamicData()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, dateFilter.startDate, dateFilter.endDate])

  const handleDateFilterChange = (value: DateFilterValue) => {
    setCurrentPage(1)
    setDateFilter(value)
  }

  // Compute absent days (excludes today and future)
  const absentDays = computeAbsentDays(
    new Date(dateFilter.startDate + 'T00:00:00.000Z'),
    new Date(dateFilter.endDate + 'T00:00:00.000Z'),
    workingDays,
    attendance.map(a => new Date(a.date)),
    leaves.map(l => new Date(l.date)),
    offDays.map(o => new Date(o.date)),
    holidays.map(h => new Date(h.date))
  )

  // Build unified timeline sorted by date descending
  const timeline: TimelineRow[] = [
    ...attendance.map(a => ({ kind: 'attendance' as const, data: a })),
    ...leaves.map(l => ({ kind: 'leave' as const, data: l })),
    ...absentDays.map(d => ({ kind: 'absent' as const, date: d.toISOString() })),
  ]
  const getRowDate = (row: TimelineRow) =>
    row.kind === 'attendance' ? row.data.date :
    row.kind === 'leave' ? row.data.date : row.date
  timeline.sort((a, b) => new Date(getRowDate(b)).getTime() - new Date(getRowDate(a)).getTime())

  // Stats (full timeline, not paginated)
  const lateDays = attendance.filter(a => a.lateMinutes > 0).length
  const totalHours = attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0)
  const lateFine = attendance.reduce((sum, a) => sum + a.fineAmount, 0)
  const absenceFine = absentDays.length * leaveCost
  const grandTotal = lateFine + absenceFine

  // Pagination
  const totalPages = Math.ceil(timeline.length / PAGE_SIZE)
  const paginatedTimeline = timeline.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageStart = (currentPage - 1) * PAGE_SIZE

  const formatHours = (hours: number | null) => hours ? `${hours.toFixed(1)}h` : '—'

  const getStatusBadge = (row: TimelineRow) => {
    if (row.kind === 'absent') {
      return <Badge variant="destructive">Absent</Badge>
    }
    if (row.kind === 'leave') {
      return row.data.isPaid
        ? <Badge className="bg-blue-500">On Leave · Paid</Badge>
        : <Badge className="bg-indigo-500">On Leave · Unpaid</Badge>
    }
    if (row.data.isAutoLeave) return <Badge variant="outline">On Leave</Badge>
    if (row.data.lateMinutes > 0) return <Badge className="bg-orange-500">Present · Late</Badge>
    return <Badge className="bg-green-500">Present</Badge>
  }

  if (status === 'loading' || initialLoading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading attendance..." />
      </DashboardLayout>
    )
  }

  if (!session) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Attendance</h1>
            <p className="text-muted-foreground">
              View your attendance history and statistics
            </p>
          </div>
          <DateFilter
            modes={['month', 'range']}
            monthCount={12}
            onChange={handleDateFilterChange}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Total Days</CardDescription>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{timeline.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Late Days</CardDescription>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">{lateDays}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Total Hours</CardDescription>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalHours.toFixed(1)}h</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Late Fine</CardDescription>
              <TrendingUp className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">Rs.{lateFine}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Absence Fine</CardDescription>
              <UserX className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">Rs.{absenceFine}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Total Fine</CardDescription>
              <TrendingUp className="h-4 w-4 text-red-700" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-700">Rs.{grandTotal}</div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline Table */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
            <CardDescription>
              Check-ins, leaves, and absent days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No records found.
              </div>
            ) : (
              <>
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
                          {row.kind === 'attendance' ? formatTime(row.data.checkInTime) : '—'}
                        </TableCell>
                        <TableCell>
                          {row.kind === 'attendance' ? formatTime(row.data.checkOutTime) : '—'}
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
      </div>
    </DashboardLayout>
  )
}
