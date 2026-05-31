'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Check, X, Clock, Loader2, Plus, CalendarRange } from 'lucide-react'
import { PageLoader } from '@/components/ui/loader'
import { DateFilter, DateFilterValue, getCurrentMonthRange } from '@/components/date-filter'
import { toast } from 'sonner'

interface User {
  id: string
  name: string | null
  email: string
  designation: string | null
  employeeId: string | null
}

interface Approver {
  id: string
  name: string | null
}

interface Leave {
  id: string
  date: string
  reason: string
  leaveType: 'PAID' | 'UNPAID' | 'SICK' | 'CASUAL'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  isPaid: boolean
  createdAt: string
  user: User
  approver: Approver | null
}

interface EmployeeOption {
  id: string
  name: string | null
  employeeId: string | null
}

export default function AdminLeavesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => getCurrentMonthRange())

  // Add leave dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addRangeMode, setAddRangeMode] = useState(false)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [addForm, setAddForm] = useState({
    userId: '',
    date: '',
    endDate: '',
    leaveType: 'UNPAID' as 'PAID' | 'UNPAID' | 'SICK' | 'CASUAL',
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard/employee')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session && session.user.role === 'ADMIN') {
      fetchLeaves()
    }
  }, [session, filter, dateFilter.startDate, dateFilter.endDate])

  const fetchLeaves = async () => {
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      params.set('startDate', dateFilter.startDate)
      params.set('endDate', dateFilter.endDate)
      const response = await fetch(`/api/leaves?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch leaves')
      }

      setLeaves(data.leaves)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leaves')
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const [empRes, settingsRes] = await Promise.all([
        fetch('/api/employees?all=true&status=active'),
        fetch('/api/settings'),
      ])
      if (empRes.ok) {
        const data = await empRes.json()
        setEmployees(data.employees || [])
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        if (data.settings?.workingDays) {
          setWorkingDays(data.settings.workingDays.split(',').map(Number))
        }
      }
    } catch {
      // non-critical
    }
  }

  const handleOpenAddDialog = () => {
    fetchEmployees()
    setAddRangeMode(false)
    setAddForm({ userId: '', date: '', endDate: '', leaveType: 'UNPAID', reason: '' })
    setAddDialogOpen(true)
  }

  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const url = addRangeMode && addForm.endDate ? '/api/leaves/batch' : '/api/leaves'
      const body = addRangeMode && addForm.endDate
        ? { userId: addForm.userId, startDate: addForm.date, endDate: addForm.endDate, leaveType: addForm.leaveType, reason: addForm.reason }
        : addForm
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create leave')
      toast.success(data.message || 'Leave created and approved')
      if (data.skipped && data.skipped.length > 0) {
        toast.info(`${data.skipped.length} day(s) skipped (weekends, holidays, or duplicates)`, { duration: 6000 })
      }
      setAddDialogOpen(false)
      setAddRangeMode(false)
      fetchLeaves()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create leave')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (leaveId: string, action: 'APPROVED' | 'REJECTED') => {
    setProcessing(leaveId)
    setError('')

    try {
      const response = await fetch(`/api/leaves/${leaveId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leaveId,
          status: action,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process leave')
      }

      fetchLeaves()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process leave')
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-500">Approved</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  const getLeaveTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      PAID: 'bg-blue-100 text-blue-800',
      UNPAID: 'bg-gray-100 text-gray-800',
      SICK: 'bg-red-100 text-red-800',
      CASUAL: 'bg-yellow-100 text-yellow-800',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${variants[type] || ''}`}>
        {type}
      </span>
    )
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading leaves..." />
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
            <h1 className="text-3xl font-bold">Leave Management</h1>
            <p className="text-muted-foreground">
              Review and manage employee leave requests
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DateFilter
              modes={['month', 'range']}
              monthCount={12}
              onChange={setDateFilter}
            />
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leaves</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleOpenAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Leave
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Leave Requests</CardTitle>
            <CardDescription>
              {filter === 'all'
                ? 'All leave requests from employees'
                : `Showing ${filter.toLowerCase()} leave requests`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leaves.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No leave requests found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Processed By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.map((leave) => (
                    <TableRow key={leave.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{leave.user.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {leave.user.employeeId}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(leave.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>{getLeaveTypeBadge(leave.leaveType)}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {leave.reason}
                      </TableCell>
                      <TableCell>{getStatusBadge(leave.status)}</TableCell>
                      <TableCell>
                        {leave.approver ? leave.approver.name : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {leave.status === 'PENDING' ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-500 hover:bg-green-600"
                              onClick={() => handleApprove(leave.id, 'APPROVED')}
                              disabled={processing === leave.id}
                            >
                              {processing === leave.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleApprove(leave.id, 'REJECTED')}
                              disabled={processing === leave.id}
                            >
                              {processing === leave.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Processed
                          </span>
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

      {/* Add Leave Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) { setAddRangeMode(false); setAddForm({ userId: '', date: '', endDate: '', leaveType: 'UNPAID', reason: '' }) } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Leave</DialogTitle>
            <DialogDescription>
              Create an approved leave for an employee. Past dates are allowed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddLeave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-employee">Employee *</Label>
              <Select
                value={addForm.userId}
                onValueChange={(v) => setAddForm({ ...addForm, userId: v })}
              >
                <SelectTrigger id="add-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => { setAddRangeMode(false); setAddForm(f => ({ ...f, endDate: '' })) }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${!addRangeMode ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
              >
                Single Day
              </button>
              <button
                type="button"
                onClick={() => setAddRangeMode(true)}
                className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${addRangeMode ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
              >
                <CalendarRange className="h-4 w-4" />
                Date Range
              </button>
            </div>

            {/* Date inputs */}
            {!addRangeMode ? (
              <div className="space-y-2">
                <Label htmlFor="add-date">Date *</Label>
                <Input
                  id="add-date"
                  type="date"
                  value={addForm.date}
                  onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                  required
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="add-start">From *</Label>
                  <Input
                    id="add-start"
                    type="date"
                    value={addForm.date}
                    onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-end">To *</Label>
                  <Input
                    id="add-end"
                    type="date"
                    min={addForm.date || undefined}
                    value={addForm.endDate}
                    onChange={(e) => setAddForm({ ...addForm, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>
            )}

            {/* Range preview */}
            {(() => {
              if (!addRangeMode || !addForm.date || !addForm.endDate) return null
              const start = new Date(addForm.date + 'T00:00:00.000Z')
              const end = new Date(addForm.endDate + 'T00:00:00.000Z')
              if (start > end) return <p className="text-sm text-destructive">End date must be after start date.</p>
              const dates: Date[] = []
              const cur = new Date(start)
              while (cur.getTime() <= end.getTime() && dates.length <= 30) {
                const day = cur.getUTCDay()
                const iso = day === 0 ? 7 : day
                if (workingDays.includes(iso)) dates.push(new Date(cur))
                cur.setUTCDate(cur.getUTCDate() + 1)
              }
              if (dates.length === 0) return <p className="text-sm text-destructive">No working days in selected range.</p>
              return (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium mb-1.5">
                    {dates.length} working day(s) selected
                    <span className="text-muted-foreground font-normal"> (holidays excluded at submission)</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dates.slice(0, 20).map(d => (
                      <span key={d.toISOString()} className="px-2 py-0.5 bg-background border rounded text-xs">
                        {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    ))}
                    {dates.length > 20 && <span className="px-2 py-0.5 text-xs text-muted-foreground">+{dates.length - 20} more</span>}
                  </div>
                </div>
              )
            })()}

            <div className="space-y-2">
              <Label htmlFor="add-type">Leave Type</Label>
              <Select
                value={addForm.leaveType}
                onValueChange={(v) => setAddForm({ ...addForm, leaveType: v as 'PAID' | 'UNPAID' | 'SICK' | 'CASUAL' })}
              >
                <SelectTrigger id="add-type">
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
              <Label htmlFor="add-reason">Reason *</Label>
              <Textarea
                id="add-reason"
                placeholder="Reason for leave (min 10 characters)"
                value={addForm.reason}
                onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
                required
                minLength={10}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !addForm.userId || !addForm.date || addForm.reason.length < 10 || (addRangeMode && !addForm.endDate)}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {addRangeMode ? 'Create & Approve All' : 'Create & Approve'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
