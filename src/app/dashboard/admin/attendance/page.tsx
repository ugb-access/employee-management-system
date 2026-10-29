'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Pencil, Loader2, Download, Plus, ChevronLeft, ChevronRight, UserX } from 'lucide-react'
import { exportToCSV, formatDateForExport, formatTimeForExport } from '@/lib/export'
import { formatLocalDate, formatTime, formatTimeForInput, computeAbsentDays } from '@/lib/calculations'
import { toast } from 'sonner'
import { PageLoader } from '@/components/ui/loader'
import { ReasonPicker, EMPTY_REASON } from '@/components/reason-picker'
import {
  LATE_CHECKIN_REASONS,
  EARLY_CHECKOUT_REASONS,
  FINE_WAIVER_REASONS,
  buildReason,
  parseReason,
  validateReason,
} from '@/lib/reasons'

interface UserSettings {
  checkInTime: string
  checkOutTime: string
}

interface User {
  id: string
  name: string | null
  employeeId: string | null
  settings?: UserSettings | null
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
  missingCheckoutFine?: number
  isFineWaived: boolean
  fineWaiveReason: string | null
  isAutoLeave: boolean
  isModifiedByAdmin: boolean
  user: User
}

interface Leave {
  id: string
  date: string
  leaveType: 'PAID' | 'UNPAID' | 'SICK' | 'CASUAL'
  isPaid: boolean
  reason: string
  user: User
}

interface OffDay { id: string; date: string; userId: string }
interface Holiday { id: string; date: string }

interface Employee {
  id: string
  name: string | null
  employeeId: string | null
  settings?: { checkInTime: string; checkOutTime: string } | null
}

type TimelineRow =
  | { kind: 'attendance'; data: Attendance }
  | { kind: 'leave'; data: Leave }
  | { kind: 'absent'; date: string; user: User }

const PAGE_SIZE = 10

export default function AdminAttendancePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [offDays, setOffDays] = useState<OffDay[]>([])
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [leaveCost, setLeaveCost] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => getCurrentMonthRange())
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedUserId, setSelectedUserId] = useState<string>('all')
  const lastFetchedRef = useRef<string>('')

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null)
  const [editForm, setEditForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    checkInReason: EMPTY_REASON,
    checkOutReason: EMPTY_REASON,
    isFineWaived: false,
    fineWaiveReason: EMPTY_REASON,
  })
  const [saving, setSaving] = useState(false)

  // Manual attendance dialog
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [manualForm, setManualForm] = useState({
    userId: '',
    date: '',
    checkInTime: '09:00',
    checkOutTime: '17:00',
    checkInReason: EMPTY_REASON,
    checkOutReason: EMPTY_REASON,
  })
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [globalSettingsState, setGlobalSettingsState] = useState<{
    checkInTime: string
    checkOutTime: string
  } | null>(null)

  // Convert absent → leave dialog
  const [convertLeaveOpen, setConvertLeaveOpen] = useState(false)
  const [convertLeaveTarget, setConvertLeaveTarget] = useState<{ userId: string; date: string; userName: string } | null>(null)
  const [convertLeaveForm, setConvertLeaveForm] = useState({ leaveType: 'UNPAID', reason: '' })
  const [convertLeaveSubmitting, setConvertLeaveSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard/employee')
    }
  }, [session, status, router])

  // One-time: holidays, off-days, settings
  useEffect(() => {
    if (session?.user.role === 'ADMIN') {
      Promise.all([
        fetch('/api/holidays').then(r => r.ok ? r.json() : null),
        fetch('/api/off-days').then(r => r.ok ? r.json() : null),
        fetch('/api/settings').then(r => r.ok ? r.json() : null),
      ]).then(([holidaysData, offDaysData, settingsData]) => {
        if (holidaysData) setHolidays(holidaysData.holidays || [])
        if (offDaysData) setOffDays(offDaysData.offDays || [])
        if (settingsData?.settings) {
          setWorkingDays(settingsData.settings.workingDays.split(',').map(Number))
          setLeaveCost(settingsData.settings.leaveCost || 0)
          setGlobalSettingsState({
            checkInTime: settingsData.settings.checkInTime,
            checkOutTime: settingsData.settings.checkOutTime,
          })
        }
      }).catch(console.error)
    }
  }, [session])

  useEffect(() => {
    if (session && session.user.role === 'ADMIN') {
      const filterKey = `${dateFilter.startDate}_${dateFilter.endDate}`
      if (lastFetchedRef.current !== filterKey) {
        lastFetchedRef.current = filterKey
        fetchData(!lastFetchedRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, dateFilter.startDate, dateFilter.endDate])

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setInitialLoading(true)
    try {
      const [attendanceRes, employeesRes, leavesRes] = await Promise.all([
        fetch(`/api/attendance?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`),
        fetch('/api/employees?all=true&status=active'),
        fetch(`/api/leaves?status=APPROVED&startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`),
      ])

      if (!attendanceRes.ok) throw new Error('Failed to fetch attendance')

      const attendanceData = await attendanceRes.json()
      setAttendance(attendanceData.attendance)

      if (employeesRes.ok) {
        const empData = await employeesRes.json()
        setEmployees(empData.employees)
      }

      if (leavesRes.ok) {
        const leavesData = await leavesRes.json()
        setLeaves(leavesData.leaves)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch attendance')
    } finally {
      setInitialLoading(false)
    }
  }, [dateFilter.startDate, dateFilter.endDate])

  // Build unified timeline
  const buildTimeline = (): TimelineRow[] => {
    const start = new Date(dateFilter.startDate + 'T00:00:00.000Z')
    const end = new Date(dateFilter.endDate + 'T00:00:00.000Z')
    const holidayDates = holidays.map(h => new Date(h.date))

    const timeline: TimelineRow[] = [
      ...attendance.map(a => ({ kind: 'attendance' as const, data: a })),
      ...leaves.map(l => ({ kind: 'leave' as const, data: l })),
    ]

    // Compute absent days per employee
    employees.forEach(emp => {
      const empAttendance = attendance.filter(a => a.user.id === emp.id).map(a => new Date(a.date))
      const empLeaves = leaves.filter(l => l.user.id === emp.id).map(l => new Date(l.date))
      const empOffDays = offDays.filter(o => o.userId === emp.id).map(o => new Date(o.date))
      const absentDays = computeAbsentDays(start, end, workingDays, empAttendance, empLeaves, empOffDays, holidayDates)
      absentDays.forEach(d => timeline.push({ kind: 'absent', date: d.toISOString(), user: emp }))
    })

    return timeline
  }

  const getRowDate = (row: TimelineRow) =>
    row.kind === 'attendance' ? row.data.date :
    row.kind === 'leave' ? row.data.date : row.date

  const getRowUser = (row: TimelineRow): User =>
    row.kind === 'attendance' ? row.data.user :
    row.kind === 'leave' ? row.data.user : row.user

  const allTimeline = buildTimeline()

  const filteredTimeline = selectedUserId === 'all'
    ? allTimeline
    : allTimeline.filter(row => getRowUser(row).id === selectedUserId)

  filteredTimeline.sort((a, b) => {
    const dateDiff = new Date(getRowDate(b)).getTime() - new Date(getRowDate(a)).getTime()
    if (dateDiff !== 0) return dateDiff
    return (getRowUser(a).name || '').localeCompare(getRowUser(b).name || '')
  })

  // Summary stats over filteredTimeline
  const totalPresent = filteredTimeline.filter(r => r.kind === 'attendance' && !r.data.isAutoLeave).length
  const totalAbsent = filteredTimeline.filter(r => r.kind === 'absent').length
  const totalOnLeave = filteredTimeline.filter(r => r.kind === 'leave').length +
    filteredTimeline.filter(r => r.kind === 'attendance' && r.data.isAutoLeave).length
  const totalLate = filteredTimeline.filter(r => r.kind === 'attendance' && r.data.lateMinutes > 0).length

  const totalPages = Math.ceil(filteredTimeline.length / PAGE_SIZE)
  const paginatedTimeline = filteredTimeline.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageStart = (currentPage - 1) * PAGE_SIZE

  const getStatusBadge = (row: TimelineRow) => {
    if (row.kind === 'absent') return <Badge variant="destructive" className="text-xs">Absent</Badge>
    if (row.kind === 'leave') {
      return row.data.isPaid
        ? <Badge className="bg-blue-500 text-xs">On Leave · Paid</Badge>
        : <Badge className="bg-indigo-500 text-xs">On Leave · Unpaid</Badge>
    }
    const rec = row.data
    if (rec.isAutoLeave) return <Badge variant="outline" className="text-xs">Auto Leave</Badge>
    if (rec.lateMinutes > 0) return <Badge className="bg-orange-500 text-xs">Present · Late</Badge>
    return <Badge className="bg-green-500 text-xs">Present</Badge>
  }

  const openEditDialog = (record: Attendance) => {
    setEditingAttendance(record)
    setEditForm({
      checkInTime: formatTimeForInput(record.checkInTime),
      checkOutTime: formatTimeForInput(record.checkOutTime),
      checkInReason: parseReason(record.checkInReason, LATE_CHECKIN_REASONS),
      checkOutReason: parseReason(record.checkOutReason, EARLY_CHECKOUT_REASONS),
      isFineWaived: record.isFineWaived,
      fineWaiveReason: parseReason(record.fineWaiveReason, FINE_WAIVER_REASONS),
    })
    setEditDialogOpen(true)
  }

  const openConvertLeave = (row: TimelineRow & { kind: 'absent' }) => {
    setConvertLeaveTarget({ userId: row.user.id, date: row.date.split('T')[0], userName: row.user.name || '' })
    setConvertLeaveForm({ leaveType: 'UNPAID', reason: '' })
    setConvertLeaveOpen(true)
  }

  const editCheckInLimit = editingAttendance?.user.settings?.checkInTime || globalSettingsState?.checkInTime || '09:00'
  const editCheckOutLimit = editingAttendance?.user.settings?.checkOutTime || globalSettingsState?.checkOutTime || '17:00'
  const isEditLate = !!editForm.checkInTime && editForm.checkInTime > editCheckInLimit
  const isEditEarly = !!editForm.checkOutTime && editForm.checkOutTime < editCheckOutLimit

  const handleEditSubmit = async () => {
    if (!editingAttendance) return
    const checkInReason = buildReason(editForm.checkInReason.choice, editForm.checkInReason.details)
    const checkOutReason = buildReason(editForm.checkOutReason.choice, editForm.checkOutReason.details)
    const fineWaiveReason = buildReason(editForm.fineWaiveReason.choice, editForm.fineWaiveReason.details)
    const reasonError =
      (isEditLate && validateReason(checkInReason, LATE_CHECKIN_REASONS) && `Check-in reason: ${validateReason(checkInReason, LATE_CHECKIN_REASONS)}`) ||
      (isEditEarly && validateReason(checkOutReason, EARLY_CHECKOUT_REASONS) && `Check-out reason: ${validateReason(checkOutReason, EARLY_CHECKOUT_REASONS)}`) ||
      (editForm.isFineWaived && validateReason(fineWaiveReason, FINE_WAIVER_REASONS) && `Waiver reason: ${validateReason(fineWaiveReason, FINE_WAIVER_REASONS)}`)
    if (reasonError) {
      toast.error(reasonError)
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/attendance/${editingAttendance.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInTime: editForm.checkInTime || undefined,
          checkOutTime: editForm.checkOutTime || undefined,
          checkInReason: isEditLate ? checkInReason : undefined,
          checkOutReason: isEditEarly ? checkOutReason : undefined,
          isFineWaived: editForm.isFineWaived,
          fineWaiveReason: editForm.isFineWaived ? fineWaiveReason : undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update attendance')
      toast.success('Attendance updated successfully')
      setEditDialogOpen(false)
      fetchData(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update attendance')
    } finally {
      setSaving(false)
    }
  }

  const manualEmployee = employees.find((emp) => emp.id === manualForm.userId)
  const manualCheckInLimit = manualEmployee?.settings?.checkInTime || globalSettingsState?.checkInTime || '09:00'
  const manualCheckOutLimit = manualEmployee?.settings?.checkOutTime || globalSettingsState?.checkOutTime || '17:00'
  const isManualLate = !!manualForm.checkInTime && manualForm.checkInTime > manualCheckInLimit
  const isManualEarly = !!manualForm.checkOutTime && manualForm.checkOutTime < manualCheckOutLimit

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualForm.userId || !manualForm.date || !manualForm.checkInTime) {
      toast.error('Please fill in all required fields')
      return
    }
    const checkInReason = buildReason(manualForm.checkInReason.choice, manualForm.checkInReason.details)
    const checkOutReason = buildReason(manualForm.checkOutReason.choice, manualForm.checkOutReason.details)
    const reasonError =
      (isManualLate && validateReason(checkInReason, LATE_CHECKIN_REASONS) && `Check-in reason: ${validateReason(checkInReason, LATE_CHECKIN_REASONS)}`) ||
      (isManualEarly && validateReason(checkOutReason, EARLY_CHECKOUT_REASONS) && `Check-out reason: ${validateReason(checkOutReason, EARLY_CHECKOUT_REASONS)}`)
    if (reasonError) {
      toast.error(reasonError)
      return
    }
    setManualSubmitting(true)
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: manualForm.userId,
          date: manualForm.date,
          checkInTime: manualForm.checkInTime,
          checkOutTime: manualForm.checkOutTime || undefined,
          checkInReason: isManualLate ? checkInReason : undefined,
          checkOutReason: isManualEarly ? checkOutReason : undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create attendance')
      toast.success('Attendance created successfully')
      setManualDialogOpen(false)
      setManualForm({ userId: '', date: '', checkInTime: '09:00', checkOutTime: '17:00', checkInReason: EMPTY_REASON, checkOutReason: EMPTY_REASON })
      fetchData(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create attendance')
    } finally {
      setManualSubmitting(false)
    }
  }

  const handleConvertLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!convertLeaveTarget || convertLeaveForm.reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters')
      return
    }
    setConvertLeaveSubmitting(true)
    try {
      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: convertLeaveTarget.userId,
          date: convertLeaveTarget.date,
          leaveType: convertLeaveForm.leaveType,
          reason: convertLeaveForm.reason,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create leave')
      toast.success('Absence converted to leave successfully')
      setConvertLeaveOpen(false)
      fetchData(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create leave')
    } finally {
      setConvertLeaveSubmitting(false)
    }
  }

  const formatHours = (hours: number | null) => hours ? `${hours.toFixed(1)}h` : '—'

  const getExportFilename = () => `attendance-${dateFilter.startDate}-to-${dateFilter.endDate}`

  const getDateRangeDescription = () =>
    `${new Date(dateFilter.startDate).toLocaleDateString()} - ${new Date(dateFilter.endDate).toLocaleDateString()}`

  const handleExport = () => {
    if (attendance.length === 0) {
      toast.error('No data to export')
      return
    }
    const data = attendance.map((record) => ({
      employeeId: record.user.employeeId || '',
      employeeName: record.user.name || '',
      date: formatDateForExport(record.date),
      checkIn: formatTimeForExport(record.checkInTime),
      checkOut: formatTimeForExport(record.checkOutTime),
      totalHours: record.totalHours?.toFixed(2) || '0',
      lateMinutes: record.lateMinutes,
      earlyMinutes: record.earlyMinutes,
      fineAmount: record.fineAmount,
      status: record.isAutoLeave ? 'Auto Leave' : 'Present',
    }))
    exportToCSV(data, [
      { header: 'Employee ID', accessor: 'employeeId' },
      { header: 'Employee Name', accessor: 'employeeName' },
      { header: 'Date', accessor: 'date' },
      { header: 'Check In', accessor: 'checkIn' },
      { header: 'Check Out', accessor: 'checkOut' },
      { header: 'Total Hours', accessor: 'totalHours' },
      { header: 'Late (min)', accessor: 'lateMinutes' },
      { header: 'Early (min)', accessor: 'earlyMinutes' },
      { header: 'Fine (Rs.)', accessor: 'fineAmount' },
      { header: 'Status', accessor: 'status' },
    ], getExportFilename())
    toast.success('Attendance exported successfully')
  }

  const handleDateFilterChange = (value: DateFilterValue) => {
    setCurrentPage(1)
    setDateFilter(value)
  }

  const getMaxDate = () => formatLocalDate(new Date())

  if (status === 'loading' || initialLoading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading attendance..." />
      </DashboardLayout>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Attendance Management</h1>
              <p className="text-muted-foreground">
                View and manage employee attendance records
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setManualDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Mark Attendance
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={attendance.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <DateFilter
              modes={['month', 'range']}
              monthCount={12}
              onChange={handleDateFilterChange}
            />
            <Select
              value={selectedUserId}
              onValueChange={(v) => { setSelectedUserId(v); setCurrentPage(1) }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Present</CardDescription>
              <span className="h-4 w-4 rounded-full bg-green-500 inline-block" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-green-600">{totalPresent}</div>
              <p className="text-xs text-muted-foreground mt-1">days checked in</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Absent</CardDescription>
              <UserX className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-red-500">{totalAbsent}</div>
              <p className="text-xs text-muted-foreground mt-1">days not present</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>On Leave</CardDescription>
              <span className="h-4 w-4 rounded-full bg-blue-500 inline-block" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">{totalOnLeave}</div>
              <p className="text-xs text-muted-foreground mt-1">approved leaves</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Late</CardDescription>
              <span className="h-4 w-4 rounded-full bg-orange-500 inline-block" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-orange-500">{totalLate}</div>
              <p className="text-xs text-muted-foreground mt-1">late check-ins</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Timeline</CardTitle>
            <CardDescription>
              Check-ins, leaves, and absent days · {getDateRangeDescription()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTimeline.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No records found for the selected period.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Late (min)</TableHead>
                        <TableHead>Early (min)</TableHead>
                        <TableHead>Fine</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTimeline.map((row) => {
                        const user = getRowUser(row)
                        const rowKey =
                          row.kind === 'attendance' ? `att-${row.data.id}` :
                          row.kind === 'leave' ? `leave-${row.data.id}` :
                          `absent-${user.id}-${row.date}`
                        return (
                          <TableRow key={rowKey}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.employeeId}</p>
                              </div>
                            </TableCell>
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
                                    <p className="text-xs text-muted-foreground truncate max-w-24">
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
                                    <p className="text-xs text-muted-foreground truncate max-w-24">
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
                                ? row.data.isFineWaived
                                  ? <span title={row.data.fineWaiveReason || undefined}>
                                      <Badge variant="secondary" className="text-xs">Waived</Badge>
                                      {row.data.fineWaiveReason && (
                                        <span className="block text-xs text-muted-foreground truncate max-w-32">{row.data.fineWaiveReason}</span>
                                      )}
                                    </span>
                                  : row.data.fineAmount > 0
                                    ? <span className="text-red-500">
                                        Rs.{row.data.fineAmount}
                                        {(row.data.missingCheckoutFine ?? 0) > 0 && (
                                          <span className="block text-xs text-muted-foreground">incl. Rs.{row.data.missingCheckoutFine} no checkout</span>
                                        )}
                                      </span>
                                    : 'Rs.0'
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {getStatusBadge(row)}
                                {row.kind === 'attendance' && row.data.isModifiedByAdmin && (
                                  <Badge variant="secondary" className="text-xs">Modified</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {row.kind === 'attendance' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(row.data)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {row.kind === 'absent' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7 px-2"
                                  onClick={() => openConvertLeave(row)}
                                >
                                  <UserX className="h-3 w-3 mr-1" />
                                  Mark Leave
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                {filteredTimeline.length > PAGE_SIZE && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredTimeline.length)} of {filteredTimeline.length} records
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

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Attendance</DialogTitle>
              <DialogDescription>
                Modify attendance for {editingAttendance?.user.name} on{' '}
                {editingAttendance && new Date(editingAttendance.date).toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="checkInTime">Check In Time</Label>
                  <Input
                    id="checkInTime"
                    type="time"
                    value={editForm.checkInTime}
                    onChange={(e) => setEditForm({ ...editForm, checkInTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOutTime">Check Out Time</Label>
                  <Input
                    id="checkOutTime"
                    type="time"
                    value={editForm.checkOutTime}
                    onChange={(e) => setEditForm({ ...editForm, checkOutTime: e.target.value })}
                  />
                </div>
              </div>
              {isEditLate && (
                <div className="space-y-2">
                  <ReasonPicker
                    id="checkInReason"
                    label="Check In Reason"
                    options={LATE_CHECKIN_REASONS}
                    value={editForm.checkInReason}
                    onChange={(checkInReason) => setEditForm({ ...editForm, checkInReason })}
                  />
                  <p className="text-xs text-muted-foreground">Check-in time is after {editCheckInLimit}.</p>
                </div>
              )}
              {isEditEarly && (
                <div className="space-y-2">
                  <ReasonPicker
                    id="checkOutReason"
                    label="Check Out Reason"
                    options={EARLY_CHECKOUT_REASONS}
                    value={editForm.checkOutReason}
                    onChange={(checkOutReason) => setEditForm({ ...editForm, checkOutReason })}
                  />
                  <p className="text-xs text-muted-foreground">Check-out time is before {editCheckOutLimit}.</p>
                </div>
              )}
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="isFineWaived">Waive fine for this day</Label>
                    <p className="text-xs text-muted-foreground">
                      {editingAttendance && editingAttendance.fineAmount > 0 && !editingAttendance.isFineWaived
                        ? `Removes the Rs.${editingAttendance.fineAmount} fine for this day`
                        : 'No late or missing checkout fine will be charged for this day'}
                    </p>
                  </div>
                  <Switch
                    id="isFineWaived"
                    checked={editForm.isFineWaived}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, isFineWaived: checked })}
                  />
                </div>
                {editForm.isFineWaived && (
                  <ReasonPicker
                    id="fineWaiveReason"
                    label="Waiver Reason"
                    options={FINE_WAIVER_REASONS}
                    value={editForm.fineWaiveReason}
                    onChange={(fineWaiveReason) => setEditForm({ ...editForm, fineWaiveReason })}
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleEditSubmit} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Attendance Dialog */}
        <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark Attendance</DialogTitle>
              <DialogDescription>
                Manually create an attendance record for an employee
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Employee *</Label>
                <Select
                  value={manualForm.userId}
                  onValueChange={(value) => setManualForm({ ...manualForm, userId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} ({emp.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  max={getMaxDate()}
                  value={manualForm.date}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manualCheckInTime">Check In Time *</Label>
                  <Input
                    id="manualCheckInTime"
                    type="time"
                    value={manualForm.checkInTime}
                    onChange={(e) => setManualForm({ ...manualForm, checkInTime: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualCheckOutTime">Check Out Time</Label>
                  <Input
                    id="manualCheckOutTime"
                    type="time"
                    value={manualForm.checkOutTime}
                    onChange={(e) => setManualForm({ ...manualForm, checkOutTime: e.target.value })}
                  />
                </div>
              </div>
              {isManualLate && (
                <div className="space-y-2">
                  <ReasonPicker
                    id="manualCheckInReason"
                    label="Check In Reason"
                    options={LATE_CHECKIN_REASONS}
                    value={manualForm.checkInReason}
                    onChange={(checkInReason) => setManualForm({ ...manualForm, checkInReason })}
                  />
                  <p className="text-xs text-muted-foreground">Check-in time is after {manualCheckInLimit}.</p>
                </div>
              )}
              {isManualEarly && (
                <div className="space-y-2">
                  <ReasonPicker
                    id="manualCheckOutReason"
                    label="Check Out Reason"
                    options={EARLY_CHECKOUT_REASONS}
                    value={manualForm.checkOutReason}
                    onChange={(checkOutReason) => setManualForm({ ...manualForm, checkOutReason })}
                  />
                  <p className="text-xs text-muted-foreground">Check-out time is before {manualCheckOutLimit}.</p>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setManualDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={manualSubmitting || !manualForm.userId || !manualForm.date}>
                  {manualSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Attendance
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Convert Absent → Leave Dialog */}
        <Dialog open={convertLeaveOpen} onOpenChange={setConvertLeaveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convert Absence to Leave</DialogTitle>
              <DialogDescription>
                Mark the absence for {convertLeaveTarget?.userName} on{' '}
                {convertLeaveTarget && new Date(convertLeaveTarget.date + 'T00:00:00.000Z').toLocaleDateString('en-US', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })} as an approved leave.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleConvertLeaveSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select
                  value={convertLeaveForm.leaveType}
                  onValueChange={(v) => setConvertLeaveForm({ ...convertLeaveForm, leaveType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="UNPAID">Unpaid</SelectItem>
                    <SelectItem value="SICK">Sick</SelectItem>
                    <SelectItem value="CASUAL">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="convertReason">Reason *</Label>
                <Textarea
                  id="convertReason"
                  placeholder="Reason for leave (min 10 characters)"
                  value={convertLeaveForm.reason}
                  onChange={(e) => setConvertLeaveForm({ ...convertLeaveForm, reason: e.target.value })}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConvertLeaveOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={convertLeaveSubmitting || convertLeaveForm.reason.trim().length < 10}>
                  {convertLeaveSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Leave
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
