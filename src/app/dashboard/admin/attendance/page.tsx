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
import { Pencil, Loader2, Download, Plus } from 'lucide-react'
import { exportToCSV, formatDateForExport, formatTimeForExport } from '@/lib/export'
import { formatLocalDate } from '@/lib/calculations'
import { toast } from 'sonner'
import { PageLoader } from '@/components/ui/loader'

interface User {
  id: string
  name: string | null
  employeeId: string | null
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
  user: User
}

interface Employee {
  id: string
  name: string | null
  employeeId: string | null
}

export default function AdminAttendancePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => getCurrentMonthRange())

  // Track last fetched to prevent duplicate fetches
  const lastFetchedRef = useRef<string>('')

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null)
  const [editForm, setEditForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    checkInReason: '',
    checkOutReason: '',
  })
  const [saving, setSaving] = useState(false)

  // Manual attendance dialog
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [manualForm, setManualForm] = useState({
    userId: '',
    date: '',
    checkInTime: '09:00',
    checkOutTime: '17:00',
    checkInReason: '',
    checkOutReason: '',
  })
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [globalSettingsState, setGlobalSettingsState] = useState<{
    checkInTime: string
    checkOutTime: string
  } | null>(null)

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
      // Only fetch if filter actually changed
      if (lastFetchedRef.current !== filterKey) {
        lastFetchedRef.current = filterKey
        fetchData(!lastFetchedRef.current) // Only show loader on initial load
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, dateFilter.startDate, dateFilter.endDate])

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setInitialLoading(true)
    try {
      const [attendanceRes, employeesRes] = await Promise.all([
        fetch(`/api/attendance?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`),
        fetch('/api/employees?page=1&status=active'),
      ])

      const attendanceData = await attendanceRes.json()
      const employeesData = await employeesRes.json()

      if (!attendanceRes.ok) {
        throw new Error(attendanceData.error || 'Failed to fetch attendance')
      }

      setAttendance(attendanceData.attendance)
      if (employeesRes.ok) {
        setEmployees(employeesData.employees)
      }

      // Fetch global settings for check-in/out times
      const settingsRes = await fetch('/api/settings')
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        setGlobalSettingsState(settingsData.settings)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch attendance')
    } finally {
      setInitialLoading(false)
    }
  }, [dateFilter.startDate, dateFilter.endDate])

  const openEditDialog = (record: Attendance) => {
    setEditingAttendance(record)
    setEditForm({
      checkInTime: record.checkInTime
        ? new Date(record.checkInTime).toTimeString().slice(0, 5)
        : '',
      checkOutTime: record.checkOutTime
        ? new Date(record.checkOutTime).toTimeString().slice(0, 5)
        : '',
      checkInReason: record.checkInReason || '',
      checkOutReason: record.checkOutReason || '',
    })
    setEditDialogOpen(true)
  }

  const handleEditSubmit = async () => {
    if (!editingAttendance) return

    // Check if check-in is late (after configured check-in time)
    const checkInTimeStr = globalSettingsState?.checkInTime || '09:00'
    if (editForm.checkInTime > checkInTimeStr && !editForm.checkInReason.trim()) {
      toast.error('Check-in reason is required for late check-in')
      return
    }

    // Check if checkout is early (before configured check-out time)
    const checkOutTimeStr = globalSettingsState?.checkOutTime || '17:00'
    if (editForm.checkOutTime && editForm.checkOutTime < checkOutTimeStr && !editForm.checkOutReason.trim()) {
      toast.error('Check-out reason is required for early check-out')
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/attendance/${editingAttendance.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkInTime: editForm.checkInTime || undefined,
          checkOutTime: editForm.checkOutTime || undefined,
          checkInReason: editForm.checkInReason || undefined,
          checkOutReason: editForm.checkOutReason || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update attendance')
      }

      toast.success('Attendance updated successfully')
      setEditDialogOpen(false)
      fetchData(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update attendance')
    } finally {
      setSaving(false)
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!manualForm.userId || !manualForm.date || !manualForm.checkInTime) {
      toast.error('Please fill in all required fields')
      return
    }

    // Check if check-in is late (after configured check-in time)
    const checkInTimeStr = globalSettingsState?.checkInTime || '09:00'
    if (manualForm.checkInTime > checkInTimeStr && !manualForm.checkInReason.trim()) {
      toast.error('Check-in reason is required for late check-in')
      return
    }

    // Check if checkout is early (before configured check-out time)
    const checkOutTimeStr = globalSettingsState?.checkOutTime || '17:00'
    if (manualForm.checkOutTime && manualForm.checkOutTime < checkOutTimeStr && !manualForm.checkOutReason.trim()) {
      toast.error('Check-out reason is required for early check-out')
      return
    }

    setManualSubmitting(true)

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(manualForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create attendance')
      }

      toast.success('Attendance created successfully')
      setManualDialogOpen(false)
      setManualForm({
        userId: '',
        date: '',
        checkInTime: '09:00',
        checkOutTime: '17:00',
        checkInReason: '',
        checkOutReason: '',
      })
      fetchData(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create attendance')
    } finally {
      setManualSubmitting(false)
    }
  }

  const formatTime = (date: string | Date | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatHours = (hours: number | null) => {
    if (!hours) return '-'
    return `${hours.toFixed(1)}h`
  }

  const getExportFilename = () => {
    return `attendance-${dateFilter.startDate}-to-${dateFilter.endDate}`
  }

  const getDateRangeDescription = () => {
    return `${new Date(dateFilter.startDate).toLocaleDateString()} - ${new Date(dateFilter.endDate).toLocaleDateString()}`
  }

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

  // Get max date for manual attendance (today)
  const getMaxDate = () => {
    // Use local date formatting to avoid timezone offset issues
    return formatLocalDate(new Date())
  }

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Attendance Management</h1>
              <p className="text-muted-foreground">
                View and manage employee attendance records
              </p>
            </div>
            <div className="flex items-center gap-2">
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

          {/* Filter */}
          <DateFilter
            modes={['month', 'range']}
            monthCount={12}
            onChange={setDateFilter}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
            <CardDescription>
              {getDateRangeDescription()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attendance.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No attendance records found for the selected period.
              </div>
            ) : (
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
                    {attendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{record.user.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {record.user.employeeId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(record.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{formatTime(record.checkInTime)}</p>
                            {record.checkInReason && (
                              <p className="text-xs text-muted-foreground truncate max-w-24">
                                {record.checkInReason}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{formatTime(record.checkOutTime)}</p>
                            {record.checkOutReason && (
                              <p className="text-xs text-muted-foreground truncate max-w-24">
                                {record.checkOutReason}
                              </p>
                            )}
                          </div>
                        </TableCell>
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
                          <div className="flex flex-col gap-1">
                            {record.isAutoLeave && (
                              <Badge variant="outline" className="text-xs">
                                Auto Leave
                              </Badge>
                            )}
                            {record.isModifiedByAdmin && (
                              <Badge variant="secondary" className="text-xs">
                                Modified
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(record)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
                {editingAttendance &&
                  new Date(editingAttendance.date).toLocaleDateString()}
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
                    onChange={(e) =>
                      setEditForm({ ...editForm, checkInTime: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOutTime">Check Out Time</Label>
                  <Input
                    id="checkOutTime"
                    type="time"
                    value={editForm.checkOutTime}
                    onChange={(e) =>
                      setEditForm({ ...editForm, checkOutTime: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkInReason">
                  Check In Reason
                  {editForm.checkInTime > (globalSettingsState?.checkInTime || '09:00') && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                <Textarea
                  id="checkInReason"
                  placeholder={editForm.checkInTime > (globalSettingsState?.checkInTime || '09:00')
                    ? "Required: Reason for late check-in"
                    : "Reason for late check-in (if any)"}
                  value={editForm.checkInReason}
                  onChange={(e) =>
                    setEditForm({ ...editForm, checkInReason: e.target.value })
                  }
                />
                {editForm.checkInTime > (globalSettingsState?.checkInTime || '09:00') && (
                  <p className="text-xs text-muted-foreground">
                    Check-in time is after {globalSettingsState?.checkInTime || '09:00'}. Reason is required.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOutReason">
                  Check Out Reason
                  {editForm.checkOutTime && editForm.checkOutTime < (globalSettingsState?.checkOutTime || '17:00') && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                <Textarea
                  id="checkOutReason"
                  placeholder={editForm.checkOutTime && editForm.checkOutTime < (globalSettingsState?.checkOutTime || '17:00')
                    ? "Required: Reason for early check-out"
                    : "Reason for early check-out (if any)"}
                  value={editForm.checkOutReason}
                  onChange={(e) =>
                    setEditForm({ ...editForm, checkOutReason: e.target.value })
                  }
                />
                {editForm.checkOutTime && editForm.checkOutTime < (globalSettingsState?.checkOutTime || '17:00') && (
                  <p className="text-xs text-muted-foreground">
                    Check-out time is before {globalSettingsState?.checkOutTime || '17:00'}. Reason is required.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
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
                  onValueChange={(value) =>
                    setManualForm({ ...manualForm, userId: value })
                  }
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
                  onChange={(e) =>
                    setManualForm({ ...manualForm, date: e.target.value })
                  }
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
                    onChange={(e) =>
                      setManualForm({ ...manualForm, checkInTime: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualCheckOutTime">Check Out Time</Label>
                  <Input
                    id="manualCheckOutTime"
                    type="time"
                    value={manualForm.checkOutTime}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, checkOutTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manualCheckInReason">
                  Check In Reason
                  {manualForm.checkInTime > (globalSettingsState?.checkInTime || '09:00') && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                <Textarea
                  id="manualCheckInReason"
                  placeholder={manualForm.checkInTime > (globalSettingsState?.checkInTime || '09:00')
                    ? "Required: Reason for late check-in"
                    : "Reason for late check-in (if any)"}
                  value={manualForm.checkInReason}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, checkInReason: e.target.value })
                  }
                />
                {manualForm.checkInTime > (globalSettingsState?.checkInTime || '09:00') && (
                  <p className="text-xs text-muted-foreground">
                    Check-in time is after {globalSettingsState?.checkInTime || '09:00'}. Reason is required.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="manualCheckOutReason">
                  Check Out Reason
                  {manualForm.checkOutTime && manualForm.checkOutTime < (globalSettingsState?.checkOutTime || '17:00') && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                <Textarea
                  id="manualCheckOutReason"
                  placeholder={manualForm.checkOutTime && manualForm.checkOutTime < (globalSettingsState?.checkOutTime || '17:00')
                    ? "Required: Reason for early check-out"
                    : "Reason for early check-out (if any)"}
                  value={manualForm.checkOutReason}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, checkOutReason: e.target.value })
                  }
                />
                {manualForm.checkOutTime && manualForm.checkOutTime < (globalSettingsState?.checkOutTime || '17:00') && (
                  <p className="text-xs text-muted-foreground">
                    Check-out time is before {globalSettingsState?.checkOutTime || '17:00'}. Reason is required.
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setManualDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={manualSubmitting || !manualForm.userId || !manualForm.date}
                >
                  {manualSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Attendance
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
