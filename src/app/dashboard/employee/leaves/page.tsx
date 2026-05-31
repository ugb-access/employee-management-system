'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { formatLocalDate } from '@/lib/calculations'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Calendar, AlertTriangle, CheckCircle, XCircle, Loader2, Trash2, Info, Coins, CalendarRange } from 'lucide-react'
import { toast } from 'sonner'
import { PageLoader } from '@/components/ui/loader'
import { DateFilter, DateFilterValue, getCurrentMonthRange } from '@/components/date-filter'

interface Leave {
  id: string
  date: string
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  isPaid: boolean
  createdAt: string
}

interface GlobalSettings {
  paidLeavesPerMonth: number
  leaveCost: number
  warningLeaveCount: number
  dangerLeaveCount: number
  workingDays: string
}

export default function EmployeeLeavesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => getCurrentMonthRange())
  const [annualBalance, setAnnualBalance] = useState<{ used: number; limit: number; remaining: number } | null>(null)

  // Leave balance
  const [leaveBalance, setLeaveBalance] = useState({
    paidLeavesPerMonth: 1,
    usedThisMonth: 0,
    remaining: 1,
    leaveCost: 1000,
    warningZone: 3,
    dangerZone: 5,
  })

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    approvedThisMonth: 0,
  })

  // Leave request dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [rangeMode, setRangeMode] = useState(false)
  const [formData, setFormData] = useState({
    date: '',
    endDate: '',
    reason: '',
    leaveType: 'UNPAID' as 'PAID' | 'UNPAID' | 'SICK' | 'CASUAL',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [session, dateFilter.startDate, dateFilter.endDate])

  const fetchData = async () => {
    try {
      const [leavesRes, settingsRes] = await Promise.all([
        fetch(`/api/leaves?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`),
        fetch('/api/settings'),
      ])

      if (leavesRes.ok) {
        const leavesData = await leavesRes.json()
        setLeaves(leavesData.leaves)
        if (leavesData.annualBalance) setAnnualBalance(leavesData.annualBalance)

        // Calculate stats - only approved leaves from current month
        // Compare dates properly: DB dates are stored at midnight UTC
        const currentDate = new Date()
        // Create start of month as UTC to match database date storage
        const startOfMonthUTC = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), 1))

        const approvedLeaves = leavesData.leaves.filter(
          (l: Leave) => l.status === 'APPROVED'
        )
        const approvedThisMonth = approvedLeaves.filter(
          (l: Leave) => new Date(l.date) >= startOfMonthUTC
        )

        setStats({
          total: leavesData.leaves.length,
          pending: leavesData.leaves.filter((l: Leave) => l.status === 'PENDING').length,
          approved: approvedLeaves.length,
          rejected: leavesData.leaves.filter((l: Leave) => l.status === 'REJECTED').length,
          approvedThisMonth: approvedThisMonth.length,
        })
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        setGlobalSettings(settingsData.settings)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate leave balance when stats or settings change
  useEffect(() => {
    if (globalSettings) {
      const usedThisMonth = stats.approvedThisMonth
      const paidLeavesPerMonth = globalSettings.paidLeavesPerMonth
      const remaining = Math.max(0, paidLeavesPerMonth - usedThisMonth)

      setLeaveBalance({
        paidLeavesPerMonth,
        usedThisMonth,
        remaining,
        leaveCost: globalSettings.leaveCost,
        warningZone: globalSettings.warningLeaveCount,
        dangerZone: globalSettings.dangerLeaveCount,
      })
    }
  }, [globalSettings, stats.approvedThisMonth])

  // Calculate cost if requesting additional leave
  const calculateLeaveCost = () => {
    // If they have remaining paid leaves, no cost
    if (leaveBalance.remaining > 0) return 0
    // Otherwise, cost per additional leave
    return leaveBalance.leaveCost
  }

  const getLeaveZone = () => {
    if (leaveBalance.usedThisMonth >= leaveBalance.dangerZone) {
      return { label: 'Danger Zone', color: 'text-red-500', bg: 'bg-red-100' }
    }
    if (leaveBalance.usedThisMonth >= leaveBalance.warningZone) {
      return { label: 'Warning Zone', color: 'text-yellow-500', bg: 'bg-yellow-100' }
    }
    return { label: 'Normal', color: 'text-green-500', bg: 'bg-green-100' }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = rangeMode && formData.endDate ? '/api/leaves/batch' : '/api/leaves'
      const body = rangeMode && formData.endDate
        ? { startDate: formData.date, endDate: formData.endDate, reason: formData.reason, leaveType: formData.leaveType }
        : { date: formData.date, reason: formData.reason, leaveType: formData.leaveType }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit leave request')
      }

      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((w: string) => toast.warning(w, { duration: 8000 }))
      } else {
        toast.success(data.message || 'Leave request submitted successfully')
      }

      if (data.skipped && data.skipped.length > 0) {
        toast.info(`${data.skipped.length} day(s) skipped (weekends, holidays, or duplicates)`, { duration: 6000 })
      }

      setDialogOpen(false)
      setFormData({ date: '', endDate: '', reason: '', leaveType: 'UNPAID' })
      setRangeMode(false)
      fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit leave request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (leaveId: string) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return

    try {
      const response = await fetch(`/api/leaves/${leaveId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to cancel leave')
      }

      toast.success('Leave request cancelled')
      fetchData()
    } catch (err: unknown) {
      toast.error('Failed to cancel leave request')
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

  const getMinDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    // Use local date formatting to avoid timezone offset issues
    return formatLocalDate(tomorrow)
  }

  const leaveZone = getLeaveZone()
  const potentialCost = calculateLeaveCost()

  // Annual pool warnings for the dialog (computed from annualBalance + current month usage)
  const annualPoolExhausted = annualBalance ? annualBalance.used >= annualBalance.limit : false
  const monthlyExceeded = leaveBalance.remaining === 0 && !annualPoolExhausted

  // Preview working days in range (client-side, excludes non-working days only)
  const previewDates = (() => {
    if (!rangeMode || !formData.date || !formData.endDate) return []
    const wd = globalSettings?.workingDays.split(',').map(Number) ?? [1, 2, 3, 4, 5]
    const start = new Date(formData.date + 'T00:00:00.000Z')
    const end = new Date(formData.endDate + 'T00:00:00.000Z')
    if (start > end) return []
    const dates: Date[] = []
    const cur = new Date(start)
    while (cur.getTime() <= end.getTime() && dates.length <= 30) {
      const day = cur.getUTCDay()
      const iso = day === 0 ? 7 : day
      if (wd.includes(iso)) dates.push(new Date(cur))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return dates
  })()

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading leaves..." />
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
            <h1 className="text-3xl font-bold">My Leaves</h1>
            <p className="text-muted-foreground">
              Request and manage your leave applications
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DateFilter
              modes={['month', 'range']}
              monthCount={12}
              onChange={setDateFilter}
            />
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Request Leave
            </Button>
          </div>
        </div>

        {/* Annual Leave Balance Card */}
        {annualBalance && (
          <Card className={annualPoolExhausted ? 'border-red-400' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Annual Leave Pool — {new Date().getFullYear()}
              </CardTitle>
              <CardDescription>
                Total leaves available per year across all months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Annual Allocation</p>
                  <p className="text-2xl font-bold">{annualBalance.limit}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Used This Year</p>
                  <p className={`text-2xl font-bold ${annualBalance.used > 0 ? 'text-orange-500' : ''}`}>
                    {annualBalance.used}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Remaining</p>
                  <p className={`text-2xl font-bold ${annualBalance.remaining === 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {annualBalance.remaining}
                  </p>
                </div>
              </div>
              {annualPoolExhausted && (
                <Alert className="mt-4 border-red-500 bg-red-50 dark:bg-red-950">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    You have used all {annualBalance.limit} annual leaves. Any additional leave will be unpaid and subject to a deduction of Rs.{leaveBalance.leaveCost}.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Leave Balance Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leave Balance - This Month
            </CardTitle>
            <CardDescription>
              Your leave allocation and usage for the current month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Allocated Paid Leaves</p>
                <p className="text-2xl font-bold">{leaveBalance.paidLeavesPerMonth}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Used This Month</p>
                <p className={`text-2xl font-bold ${leaveBalance.usedThisMonth > 0 ? 'text-orange-500' : ''}`}>
                  {leaveBalance.usedThisMonth}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className={`text-2xl font-bold ${leaveBalance.remaining === 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {leaveBalance.remaining}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <div className={`inline-flex items-center px-3 py-1 rounded-full ${leaveZone.bg}`}>
                  <span className={`font-medium ${leaveZone.color}`}>{leaveZone.label}</span>
                </div>
              </div>
            </div>

            {leaveBalance.usedThisMonth >= leaveBalance.warningZone && (
              <Alert className="mt-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  {leaveBalance.usedThisMonth >= leaveBalance.dangerZone
                    ? `You are in the danger zone! You've used ${leaveBalance.usedThisMonth} leaves this month.`
                    : `Warning: You've used ${leaveBalance.usedThisMonth} leaves this month. Be mindful of your leave balance.`}
                </AlertDescription>
              </Alert>
            )}

            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p><strong>Leave Policy:</strong></p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>You get {leaveBalance.paidLeavesPerMonth} free paid leave(s) per month</li>
                    <li>Additional paid leaves cost Rs.{leaveBalance.leaveCost} each</li>
                    <li>{leaveBalance.warningZone}+ leaves = Warning Zone, {leaveBalance.dangerZone}+ leaves = Danger Zone</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Total Requests</CardDescription>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Pending</CardDescription>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-500">
                {stats.pending}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Approved</CardDescription>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                {stats.approved}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Rejected</CardDescription>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                {stats.rejected}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leave Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Requests</CardTitle>
            <CardDescription>
              Your leave application history and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leaves.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No leave requests yet. Click "Request Leave" to apply.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.map((leave) => (
                    <TableRow key={leave.id}>
                      <TableCell>
                        {new Date(leave.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {leave.reason}
                      </TableCell>
                      <TableCell>{getStatusBadge(leave.status)}</TableCell>
                      <TableCell>
                        {new Date(leave.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {leave.status === 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCancel(leave.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {/* Request Leave Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setRangeMode(false); setFormData({ date: '', endDate: '', reason: '', leaveType: 'UNPAID' }) } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>
              Submit a new leave request for approval
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mode toggle */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => { setRangeMode(false); setFormData(f => ({ ...f, endDate: '' })) }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${!rangeMode ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
              >
                Single Day
              </button>
              <button
                type="button"
                onClick={() => setRangeMode(true)}
                className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${rangeMode ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
              >
                <CalendarRange className="h-4 w-4" />
                Date Range
              </button>
            </div>

            {/* Leave Balance Info */}
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <div className="flex justify-between">
                <span>Monthly free leaves remaining:</span>
                <span className={`font-medium ${leaveBalance.remaining === 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {leaveBalance.remaining} / {leaveBalance.paidLeavesPerMonth}
                </span>
              </div>
              {annualBalance && (
                <div className="flex justify-between">
                  <span>Annual pool remaining:</span>
                  <span className={`font-medium ${annualBalance.remaining === 0 ? 'text-red-500' : 'text-orange-500'}`}>
                    {annualBalance.remaining} / {annualBalance.limit}
                  </span>
                </div>
              )}
            </div>

            {/* Pre-submission warnings */}
            {annualPoolExhausted && (
              <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  <strong>Annual pool exhausted.</strong> This leave will be unpaid and a deduction of Rs.{leaveBalance.leaveCost} will apply.
                </AlertDescription>
              </Alert>
            )}
            {monthlyExceeded && annualBalance && (
              <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  Monthly free leaves used. This will deduct from your annual pool ({annualBalance.used + 1}/{annualBalance.limit} after this leave).
                </AlertDescription>
              </Alert>
            )}

            {/* Date inputs */}
            {!rangeMode ? (
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  min={getMinDate()}
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="startDate">From *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    min={getMinDate()}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">To *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    min={formData.date || getMinDate()}
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>
            )}

            {/* Range preview */}
            {rangeMode && previewDates.length > 0 && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium mb-1.5">
                  {previewDates.length} working day(s) selected
                  <span className="text-muted-foreground font-normal"> (holidays excluded at submission)</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {previewDates.slice(0, 20).map(d => (
                    <span key={d.toISOString()} className="px-2 py-0.5 bg-background border rounded text-xs">
                      {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  ))}
                  {previewDates.length > 20 && (
                    <span className="px-2 py-0.5 text-xs text-muted-foreground">+{previewDates.length - 20} more</span>
                  )}
                </div>
              </div>
            )}
            {rangeMode && formData.date && formData.endDate && previewDates.length === 0 && (
              <p className="text-sm text-destructive">No working days in selected range.</p>
            )}

            {/* Cost Warning */}
            {leaveBalance.remaining === 0 && (
              <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
                <Coins className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  You&apos;ve used all your free paid leaves. This leave will cost <strong>Rs.{potentialCost}</strong> per day.
                </AlertDescription>
              </Alert>
            )}

            {/* Leave Type */}
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <div className="flex gap-2 flex-wrap">
                {(['UNPAID', 'PAID', 'SICK', 'CASUAL'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, leaveType: t }))}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      formData.leaveType === t
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Please provide a reason for your leave request (min 10 characters)"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
                minLength={10}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  submitting ||
                  !formData.date ||
                  formData.reason.length < 10 ||
                  (rangeMode && !formData.endDate) ||
                  (rangeMode && previewDates.length === 0)
                }
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
