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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Plus, Trash2, Save } from 'lucide-react'
import { PageLoader } from '@/components/ui/loader'

interface GlobalSettings {
  id: string
  checkInTime: string
  checkOutTime: string
  requiredWorkHours: number
  gracePeriodMinutes: number
  lateFineBase: number
  lateFinePer30Min: number
  leaveCost: number
  paidLeavesPerMonth: number
  warningLeaveCount: number
  dangerLeaveCount: number
  workingDays: string
}

interface Holiday {
  id: string
  name: string
  date: string
  year: number
  isRecurring: boolean
}

// Working days use ISO weekday format: 1=Monday, 2=Tuesday, ..., 7=Sunday
const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
]

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [settings, setSettings] = useState<GlobalSettings | null>(null)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Settings form
  const [formData, setFormData] = useState({
    checkInTime: '09:00',
    checkOutTime: '17:00',
    requiredWorkHours: 8,
    gracePeriodMinutes: 15,
    lateFineBase: 250,
    lateFinePer30Min: 250,
    leaveCost: 1000,
    paidLeavesPerMonth: 1,
    warningLeaveCount: 3,
    dangerLeaveCount: 5,
    workingDays: [1, 2, 3, 4, 5],
  })

  // Holiday dialog
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false)
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    isRecurring: false,
  })
  const [savingHoliday, setSavingHoliday] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard/employee')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session && session.user.role === 'ADMIN') {
      fetchData()
    }
  }, [session])

  const fetchData = async () => {
    try {
      const [settingsRes, holidaysRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/holidays'),
      ])

      const settingsData = await settingsRes.json()
      const holidaysData = await holidaysRes.json()

      if (settingsRes.ok && settingsData.settings) {
        setSettings(settingsData.settings)
        setFormData({
          checkInTime: settingsData.settings.checkInTime,
          checkOutTime: settingsData.settings.checkOutTime,
          requiredWorkHours: settingsData.settings.requiredWorkHours,
          gracePeriodMinutes: settingsData.settings.gracePeriodMinutes ?? 15,
          lateFineBase: settingsData.settings.lateFineBase,
          lateFinePer30Min: settingsData.settings.lateFinePer30Min,
          leaveCost: settingsData.settings.leaveCost,
          paidLeavesPerMonth: settingsData.settings.paidLeavesPerMonth,
          warningLeaveCount: settingsData.settings.warningLeaveCount,
          dangerLeaveCount: settingsData.settings.dangerLeaveCount,
          workingDays: settingsData.settings.workingDays
            .split(',')
            .map(Number),
        })
      }

      if (holidaysRes.ok) {
        setHolidays(holidaysData.holidays)
      }
    } catch (err: unknown) {
      setError('Failed to fetch settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings')
      }

      setSettings(data.settings)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleAddHoliday = async () => {
    setSavingHoliday(true)
    setError('')

    try {
      const response = await fetch('/api/holidays', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(holidayForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add holiday')
      }

      setHolidays([...holidays, data.holiday])
      setHolidayDialogOpen(false)
      setHolidayForm({ name: '', date: '', isRecurring: false })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add holiday')
    } finally {
      setSavingHoliday(false)
    }
  }

  const handleDeleteHoliday = async (holidayId: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return

    try {
      const response = await fetch(`/api/holidays/${holidayId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete holiday')
      }

      setHolidays(holidays.filter((h) => h.id !== holidayId))
    } catch (err: unknown) {
      setError('Failed to delete holiday')
    }
  }

  const toggleWorkingDay = (day: number) => {
    const currentDays = formData.workingDays
    if (currentDays.includes(day)) {
      setFormData({
        ...formData,
        workingDays: currentDays.filter((d) => d !== day),
      })
    } else {
      setFormData({
        ...formData,
        workingDays: [...currentDays, day].sort(),
      })
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading settings..." />
      </DashboardLayout>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure global settings, working days, and holidays
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">
            {error}
          </div>
        )}

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General Settings</TabsTrigger>
            <TabsTrigger value="fines">Fine & Leave Settings</TabsTrigger>
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Work Schedule</CardTitle>
                <CardDescription>
                  Configure default check-in/out times and working days
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="checkInTime">Default Check-in Time</Label>
                    <Input
                      id="checkInTime"
                      type="time"
                      value={formData.checkInTime}
                      onChange={(e) =>
                        setFormData({ ...formData, checkInTime: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="checkOutTime">Default Check-out Time</Label>
                    <Input
                      id="checkOutTime"
                      type="time"
                      value={formData.checkOutTime}
                      onChange={(e) =>
                        setFormData({ ...formData, checkOutTime: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="requiredWorkHours">Required Work Hours</Label>
                    <Input
                      id="requiredWorkHours"
                      type="number"
                      step="0.5"
                      min="1"
                      max="24"
                      value={formData.requiredWorkHours}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requiredWorkHours: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Working Days</Label>
                  <div className="flex flex-wrap gap-4">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={formData.workingDays.includes(day.value)}
                          onCheckedChange={() => toggleWorkingDay(day.value)}
                        />
                        <Label htmlFor={`day-${day.value}`} className="font-normal">
                          {day.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fines">
            <Card>
              <CardHeader>
                <CardTitle>Fine & Leave Policy</CardTitle>
                <CardDescription>
                  Configure late fines and leave policies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="gracePeriodMinutes">Grace Period (minutes)</Label>
                    <Input
                      id="gracePeriodMinutes"
                      type="number"
                      min="0"
                      max="60"
                      value={formData.gracePeriodMinutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          gracePeriodMinutes: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      No fine if arriving within this time after check-in
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lateFineBase">Late Fine Base (Rs.)</Label>
                    <Input
                      id="lateFineBase"
                      type="number"
                      min="0"
                      value={formData.lateFineBase}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lateFineBase: parseInt(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Base fine charged for any lateness
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lateFinePer30Min">
                      Fine per 30 mins late (Rs.)
                    </Label>
                    <Input
                      id="lateFinePer30Min"
                      type="number"
                      min="0"
                      value={formData.lateFinePer30Min}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lateFinePer30Min: parseInt(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Additional fine for every 30 minutes late
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="leaveCost">Leave Cost (Rs.)</Label>
                    <Input
                      id="leaveCost"
                      type="number"
                      min="0"
                      value={formData.leaveCost}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          leaveCost: parseInt(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Cost per leave after free leaves are used
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paidLeavesPerMonth">
                      Free Paid Leaves/Month
                    </Label>
                    <Input
                      id="paidLeavesPerMonth"
                      type="number"
                      min="0"
                      value={formData.paidLeavesPerMonth}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          paidLeavesPerMonth: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="warningLeaveCount">Warning Zone (leaves)</Label>
                    <Input
                      id="warningLeaveCount"
                      type="number"
                      min="0"
                      value={formData.warningLeaveCount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          warningLeaveCount: parseInt(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of leaves to trigger warning status
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dangerLeaveCount">Danger Zone (leaves)</Label>
                    <Input
                      id="dangerLeaveCount"
                      type="number"
                      min="0"
                      value={formData.dangerLeaveCount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dangerLeaveCount: parseInt(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of leaves to trigger danger status
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="holidays">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Public Holidays</CardTitle>
                  <CardDescription>
                    Manage company holidays for the year
                  </CardDescription>
                </div>
                <Button onClick={() => setHolidayDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Holiday
                </Button>
              </CardHeader>
              <CardContent>
                {holidays.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No holidays configured. Add holidays for the year.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Recurring</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holidays.map((holiday) => (
                        <TableRow key={holiday.id}>
                          <TableCell className="font-medium">
                            {holiday.name}
                          </TableCell>
                          <TableCell>
                            {new Date(holiday.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </TableCell>
                          <TableCell>
                            {holiday.isRecurring ? 'Yes' : 'No'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteHoliday(holiday.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Settings
          </Button>
        </div>

        {/* Add Holiday Dialog */}
        <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Holiday</DialogTitle>
              <DialogDescription>
                Add a new public holiday
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="holidayName">Holiday Name</Label>
                <Input
                  id="holidayName"
                  placeholder="e.g., Independence Day"
                  value={holidayForm.name}
                  onChange={(e) =>
                    setHolidayForm({ ...holidayForm, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="holidayDate">Date</Label>
                <Input
                  id="holidayDate"
                  type="date"
                  value={holidayForm.date}
                  onChange={(e) =>
                    setHolidayForm({ ...holidayForm, date: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRecurring"
                  checked={holidayForm.isRecurring}
                  onCheckedChange={(checked) =>
                    setHolidayForm({
                      ...holidayForm,
                      isRecurring: checked as boolean,
                    })
                  }
                />
                <Label htmlFor="isRecurring" className="font-normal">
                  Recurring every year
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setHolidayDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddHoliday}
                disabled={savingHoliday || !holidayForm.name || !holidayForm.date}
              >
                {savingHoliday && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Holiday
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
