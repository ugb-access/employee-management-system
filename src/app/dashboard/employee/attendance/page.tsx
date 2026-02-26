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
import { Calendar, Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import { PageLoader } from '@/components/ui/loader'
import { DateFilter, DateFilterValue, getCurrentMonthRange } from '@/components/date-filter'
import { formatTime } from '@/lib/calculations'

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

export default function EmployeeAttendancePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [initialLoading, setInitialLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => getCurrentMonthRange())
  const lastFetchedRef = useRef<string>('')
  const [attendance, setAttendance] = useState<Attendance[]>([])

  const [stats, setStats] = useState({
    totalDays: 0,
    presentDays: 0,
    lateDays: 0,
    totalFines: 0,
    totalHours: 0,
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      const filterKey = `${dateFilter.startDate}_${dateFilter.endDate}`
      if (lastFetchedRef.current !== filterKey) {
        lastFetchedRef.current = filterKey
        fetchAttendance()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, dateFilter.startDate, dateFilter.endDate])

  const fetchAttendance = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/attendance?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`
      )
      const data = await response.json()

      if (response.ok) {
        setAttendance(data.attendance)

        const totalDays = data.attendance.length
        const lateDays = data.attendance.filter(
          (a: Attendance) => a.lateMinutes > 0
        ).length
        const totalFines = data.attendance.reduce(
          (sum: number, a: Attendance) => sum + a.fineAmount,
          0
        )
        const totalHours = data.attendance.reduce(
          (sum: number, a: Attendance) => sum + (a.totalHours || 0),
          0
        )

        setStats({
          totalDays,
          presentDays: totalDays,
          lateDays,
          totalFines,
          totalHours,
        })
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error)
    } finally {
      setInitialLoading(false)
    }
  }, [dateFilter.startDate, dateFilter.endDate])

  const formatHours = (hours: number | null) => {
    if (!hours) return '-'
    return `${hours.toFixed(1)}h`
  }

  if (status === 'loading' || initialLoading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading attendance..." />
      </DashboardLayout>
    )
  }

  if (!session) {
    return null
  }

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
            onChange={setDateFilter}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Total Days</CardDescription>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalDays}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Late Days</CardDescription>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">
                {stats.lateDays}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Total Hours</CardDescription>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats.totalHours.toFixed(1)}h
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Total Fines</CardDescription>
              <TrendingUp className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                Rs.{stats.totalFines}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
            <CardDescription>
              Your check-in/out records
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attendance.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No attendance records found.
              </div>
            ) : (
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
                  {attendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {new Date(record.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>{formatTime(record.checkInTime)}</TableCell>
                      <TableCell>{formatTime(record.checkOutTime)}</TableCell>
                      <TableCell>{formatHours(record.totalHours)}</TableCell>
                      <TableCell>
                        {record.lateMinutes > 0 ? (
                          <span className="text-orange-500">
                            {record.lateMinutes}
                          </span>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell>
                        {record.earlyMinutes > 0 ? (
                          <span className="text-yellow-500">
                            {record.earlyMinutes}
                          </span>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell>
                        {record.fineAmount > 0 ? (
                          <span className="text-red-500">
                            Rs.{record.fineAmount}
                          </span>
                        ) : (
                          'Rs.0'
                        )}
                      </TableCell>
                      <TableCell>
                        {record.isAutoLeave ? (
                          <Badge variant="outline">Auto Leave</Badge>
                        ) : (
                          <Badge className="bg-green-500">Present</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
