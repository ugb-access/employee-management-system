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
import { Plus, Calendar, AlertTriangle, CheckCircle, XCircle, Loader2, Trash2, Info, Coins } from 'lucide-react'
import { toast } from 'sonner'
import { PageLoader } from '@/components/ui/loader'

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
}

export default function EmployeeLeavesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null)

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
  const [formData, setFormData] = useState({
    date: '',
    reason: '',
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
  }, [session])

  const fetchData = async () => {
    try {
      const [leavesRes, settingsRes] = await Promise.all([
        fetch('/api/leaves'),
        fetch('/api/settings'),
      ])

      if (leavesRes.ok) {
        const leavesData = await leavesRes.json()
        setLeaves(leavesData.leaves)

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
      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit leave request')
      }

      toast.success('Leave request submitted successfully')
      setDialogOpen(false)
      setFormData({ date: '', reason: '' })
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Leaves</h1>
            <p className="text-muted-foreground">
              Request and manage your leave applications
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Request Leave
          </Button>
        </div>

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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>
              Submit a new leave request for approval
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Leave Balance Info */}
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="flex justify-between">
                <span>Remaining paid leaves:</span>
                <span className={`font-medium ${leaveBalance.remaining === 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {leaveBalance.remaining} / {leaveBalance.paidLeavesPerMonth}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                min={getMinDate()}
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                required
              />
            </div>

            {/* Cost Warning */}
            {leaveBalance.remaining === 0 && (
              <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
                <Coins className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  You've used all your free paid leaves. This leave will cost <strong>Rs.{potentialCost}</strong>.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Please provide a reason for your leave request (min 10 characters)"
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
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
                disabled={submitting || !formData.date || formData.reason.length < 10}
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
