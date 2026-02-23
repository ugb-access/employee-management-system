'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Clock, LogOut, LogIn, Calendar, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatTime, calculateLateFine } from '@/lib/calculations'
import { toast } from 'sonner'
import { PageLoader } from '@/components/ui/loader'

interface GlobalSettings {
  checkInTime: string
  checkOutTime: string
  requiredWorkHours: number
  lateFineBase: number
  lateFinePer30Min: number
  leaveCost: number
  warningLeaveCount: number
  dangerLeaveCount: number
  paidLeavesPerMonth: number
  workingDays: string
}

export default function EmployeeDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [todayAttendance, setTodayAttendance] = useState<{
    checkInTime: string | null
    checkOutTime: string | null
    totalHours: number
    lateMinutes: number
    earlyMinutes: number
    fineAmount: number
  } | null>(null)
  const [thisMonthLeaves, setThisMonthLeaves] = useState(0)
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [checkOutLoading, setCheckOutLoading] = useState(false)

  // Dialogs
  const [lateCheckInDialog, setLateCheckInDialog] = useState(false)
  const [lateReason, setLateReason] = useState('')
  const [potentialFine, setPotentialFine] = useState(0)
  const [lateMinutesState, setLateMinutesState] = useState(0)

  const [earlyCheckoutDialog, setEarlyCheckoutDialog] = useState(false)
  const [earlyReason, setEarlyReason] = useState('')
  const [earlyMinutesState, setEarlyMinutesState] = useState(0)

  // Current time
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session) {
      fetchDashboardData()
    }
  }, [session, status, router])

  const fetchDashboardData = useCallback(async () => {
    try {
      const today = new Date()
      const year = today.getFullYear()
      const month = today.getMonth() + 1

      const [attendanceRes, settingsRes, leavesRes] = await Promise.all([
        fetch(`/api/attendance?month=${month}&year=${year}`),
        fetch('/api/settings'),
        fetch('/api/leaves'),
      ])

      if (attendanceRes.ok) {
        const data = await attendanceRes.json()
        // Find today's attendance.
        // DB stores dates as UTC midnight (e.g. 2026-02-23T00:00:00.000Z via getTodayPKT).
        // Compare using UTC parts on the record against local date parts for today.
        const todayRecord = data.attendance.find((a: { date: string }) => {
          const d = new Date(a.date)
          return d.getUTCFullYear() === today.getFullYear() &&
                 d.getUTCMonth() === today.getMonth() &&
                 d.getUTCDate() === today.getDate()
        })
        setTodayAttendance(todayRecord || null)
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setGlobalSettings(data.settings)
      }

      if (leavesRes.ok) {
        const data = await leavesRes.json()
        const currentDate = new Date()
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const approvedLeaves = data.leaves.filter(
          (l: { status: string; date: string }) =>
            l.status === 'APPROVED' && new Date(l.date) >= startOfMonth
        )
        setThisMonthLeaves(approvedLeaves.length)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const getCheckInTime = () => globalSettings?.checkInTime || '09:00'
  const getCheckOutTime = () => globalSettings?.checkOutTime || '17:00'
  const getRequiredHours = () => globalSettings?.requiredWorkHours || 8

  const calculateLateMinutes = () => {
    const now = new Date()
    const [h, m] = getCheckInTime().split(':').map(Number)
    const checkIn = new Date(now)
    checkIn.setHours(h, m, 0, 0)
    return Math.max(0, Math.floor((now.getTime() - checkIn.getTime()) / 60000))
  }

  const calculateEarlyMinutes = () => {
    const now = new Date()
    const [h, m] = getCheckOutTime().split(':').map(Number)
    const checkOut = new Date(now)
    checkOut.setHours(h, m, 0, 0)
    return Math.max(0, Math.floor((checkOut.getTime() - now.getTime()) / 60000))
  }

  // Status
  const hasCheckedIn = !!todayAttendance?.checkInTime
  const hasCheckedOut = !!todayAttendance?.checkOutTime
  const isCheckedIn = hasCheckedIn && !hasCheckedOut
  const isDayComplete = hasCheckedOut
  const canCheckIn = !hasCheckedIn && !isDayComplete
  const canCheckOut = isCheckedIn

  // Leave zone
  const getLeaveZone = () => {
    if (!globalSettings) return { label: 'Normal', variant: 'default' as const }
    if (thisMonthLeaves >= globalSettings.dangerLeaveCount) return { label: 'Danger', variant: 'destructive' as const }
    if (thisMonthLeaves >= globalSettings.warningLeaveCount) return { label: 'Warning', variant: 'secondary' as const }
    return { label: 'Normal', variant: 'default' as const }
  }

  const remainingLeaves = globalSettings ? Math.max(0, globalSettings.paidLeavesPerMonth - thisMonthLeaves) : 0

  const handleCheckIn = () => {
    const late = calculateLateMinutes()
    if (late > 0 && globalSettings) {
      const settingsData = {
        ...globalSettings,
        workingDays: globalSettings.workingDays.split(',').map(Number),
      }
      const { lateMinutes: mins, fineAmount } = calculateLateFine(new Date(), getCheckInTime(), settingsData)
      setLateMinutesState(mins)
      setPotentialFine(fineAmount)
      setLateReason('')
      setLateCheckInDialog(true)
    } else {
      performCheckIn()
    }
  }

  const performCheckIn = async (reason?: string) => {
    setCheckInLoading(true)
    setLateCheckInDialog(false)

    try {
      const res = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to check in')
        return
      }

      toast.success(data.attendance.lateMinutes > 0
        ? `Checked in ${data.attendance.lateMinutes} min late. Fine: Rs.${data.attendance.fineAmount}`
        : 'Checked in successfully!')
      fetchDashboardData()
    } catch {
      toast.error('Failed to check in')
    } finally {
      setCheckInLoading(false)
      setLateReason('')
    }
  }

  const handleCheckOut = () => {
    const early = calculateEarlyMinutes()
    if (early > 0) {
      setEarlyMinutesState(early)
      setEarlyReason('')
      setEarlyCheckoutDialog(true)
    } else {
      performCheckOut()
    }
  }

  const performCheckOut = async (reason?: string) => {
    setCheckOutLoading(true)
    setEarlyCheckoutDialog(false)

    try {
      const res = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to check out')
        return
      }

      if (data.attendance.earlyMinutes > 0) {
        toast.warning(`Checked out ${data.attendance.earlyMinutes} min early`)
      } else {
        toast.success('Checked out successfully!')
      }
      fetchDashboardData()
    } catch {
      toast.error('Failed to check out')
    } finally {
      setCheckOutLoading(false)
      setEarlyReason('')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading dashboard..." />
      </DashboardLayout>
    )
  }

  if (!session) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome, {session.user?.name}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums">
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-sm text-muted-foreground">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="text-sm text-muted-foreground">
              Shift: {getCheckInTime()} - {getCheckOutTime()}
            </div>
          </div>
        </div>

        {/* Late Warning */}
        {!hasCheckedIn && !isDayComplete && calculateLateMinutes() > 0 && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-100">You are {calculateLateMinutes()} minutes late</p>
                  <p className="text-sm text-red-700 dark:text-red-300">A fine of Rs.{globalSettings?.lateFineBase || 250}+ will be applied</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Card */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${
                  isDayComplete ? 'bg-green-100 dark:bg-green-900' :
                  isCheckedIn ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  {isDayComplete ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : isCheckedIn ? (
                    <Clock className="h-6 w-6 text-blue-600" />
                  ) : (
                    <Clock className="h-6 w-6 text-gray-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Status</p>
                  <p className="text-xl font-semibold">
                    {isDayComplete ? 'Day Complete' : isCheckedIn ? 'Checked In' : 'Not Checked In'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  size="lg"
                  disabled={!canCheckIn || checkInLoading}
                  onClick={handleCheckIn}
                >
                  {checkInLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-5 w-5" />
                  )}
                  Check In
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={!canCheckOut || checkOutLoading}
                  onClick={handleCheckOut}
                >
                  {checkOutLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <LogOut className="mr-2 h-5 w-5" />
                  )}
                  Check Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Info */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <LogIn className="h-4 w-4" />
                <span className="text-sm">Check In</span>
              </div>
              <p className="text-2xl font-bold">
                {hasCheckedIn ? formatTime(new Date(todayAttendance.checkInTime!)) : '--:--'}
              </p>
              {(todayAttendance?.lateMinutes ?? 0) > 0 && (
                <p className="text-xs text-orange-500">{todayAttendance?.lateMinutes} min late</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Check Out</span>
              </div>
              <p className="text-2xl font-bold">
                {hasCheckedOut ? formatTime(new Date(todayAttendance.checkOutTime!)) : '--:--'}
              </p>
              {(todayAttendance?.earlyMinutes ?? 0) > 0 && (
                <p className="text-xs text-yellow-500">{todayAttendance?.earlyMinutes} min early</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Hours</span>
              </div>
              <p className="text-2xl font-bold">
                {todayAttendance?.totalHours?.toFixed(1) || '0.0'}h
              </p>
              <p className="text-xs text-muted-foreground">of {getRequiredHours()}h required</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Leaves Left</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{remainingLeaves}</p>
                <Badge variant={getLeaveZone().variant}>{getLeaveZone().label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{thisMonthLeaves} used this month</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Details */}
        {todayAttendance && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Today's Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Late By</span>
                  <p className={`font-medium ${todayAttendance.lateMinutes > 0 ? 'text-orange-500' : ''}`}>
                    {todayAttendance.lateMinutes > 0 ? `${todayAttendance.lateMinutes} min` : 'On time'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Early By</span>
                  <p className={`font-medium ${todayAttendance.earlyMinutes > 0 ? 'text-yellow-500' : ''}`}>
                    {todayAttendance.earlyMinutes > 0 ? `${todayAttendance.earlyMinutes} min` : 'Full day'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fine</span>
                  <p className={`font-medium ${todayAttendance.fineAmount > 0 ? 'text-red-500' : ''}`}>
                    Rs.{todayAttendance.fineAmount}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium">
                    {isDayComplete ? 'Complete' : isCheckedIn ? 'In Progress' : 'Pending'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Late Check-in Dialog */}
      <Dialog open={lateCheckInDialog} onOpenChange={setLateCheckInDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Late Check-in
            </DialogTitle>
            <DialogDescription>
              You are {lateMinutesState} minutes late. A fine of Rs.{potentialFine} will be applied.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lateReason">Reason <span className="text-red-500">*</span></Label>
              <Input
                id="lateReason"
                placeholder="e.g., Traffic, Doctor appointment..."
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLateCheckInDialog(false)}>Cancel</Button>
            <Button
              onClick={() => performCheckIn(lateReason.trim() || undefined)}
              disabled={checkInLoading || lateReason.trim().length < 5}
            >
              {checkInLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Early Checkout Dialog */}
      <Dialog open={earlyCheckoutDialog} onOpenChange={setEarlyCheckoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Early Checkout
            </DialogTitle>
            <DialogDescription>
              You are leaving {earlyMinutesState} minutes early.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="earlyReason">Reason <span className="text-red-500">*</span></Label>
              <Input
                id="earlyReason"
                placeholder="e.g., Doctor appointment, Family emergency..."
                value={earlyReason}
                onChange={(e) => setEarlyReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEarlyCheckoutDialog(false)}>Cancel</Button>
            <Button
              onClick={() => performCheckOut(earlyReason.trim())}
              disabled={checkOutLoading || earlyReason.trim().length < 5}
            >
              {checkOutLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
