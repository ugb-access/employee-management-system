'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
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
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, RefreshCw, Key, Copy, Check } from 'lucide-react'
import { PageLoader } from '@/components/ui/loader'

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
  accessKey: string | null
  joinedDate: string | null
  isActive: boolean
  settings: EmployeeSettings | null
}

export default function EditEmployeePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const employeeId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [accessKey, setAccessKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    designation: '',
    employeeId: '',
    joinedDate: '',
    isActive: true,
    checkInTime: '',
    checkOutTime: '',
    requiredWorkHours: '',
  })

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
    }
  }, [session, employeeId])

  const fetchEmployee = async () => {
    try {
      const response = await fetch(`/api/employees/${employeeId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch employee')
      }

      const employee: Employee = data.employee
      setFormData({
        name: employee.name || '',
        email: employee.email,
        password: '',
        designation: employee.designation || '',
        employeeId: employee.employeeId || '',
        joinedDate: employee.joinedDate ? employee.joinedDate.split('T')[0] : '',
        isActive: employee.isActive,
        checkInTime: employee.settings?.checkInTime || '',
        checkOutTime: employee.settings?.checkOutTime || '',
        requiredWorkHours: employee.settings?.requiredWorkHours?.toString() || '',
      })
      setAccessKey(employee.accessKey)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch employee')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error('Failed to copy')
    }
  }

  const handleRegenerateKey = async () => {
    if (!confirm('Are you sure? The old access key will stop working immediately.')) {
      return
    }

    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ regenerateAccessKey: true }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate access key')
      }

      setAccessKey(data.employee.accessKey)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate access key')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password || undefined,
          designation: formData.designation,
          isActive: formData.isActive,
          joinedDate: formData.joinedDate || undefined,
          checkInTime: formData.checkInTime || undefined,
          checkOutTime: formData.checkOutTime || undefined,
          requiredWorkHours: formData.requiredWorkHours
            ? parseFloat(formData.requiredWorkHours)
            : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update employee')
      }

      router.push('/dashboard/admin/employees')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update employee')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading employee..." />
      </DashboardLayout>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/employees">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Employee</h1>
            <p className="text-muted-foreground">
              Update employee information and settings
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
            <CardDescription>
              Update the employee details. Leave password blank to keep current password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@company.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Leave blank to keep current"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID</Label>
                  <Input
                    id="employeeId"
                    value={formData.employeeId}
                    readOnly
                    disabled
                    className="bg-muted font-mono"
                  />
                  <p className="text-xs text-muted-foreground">Auto-generated, cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="designation">Designation *</Label>
                  <Input
                    id="designation"
                    placeholder="Software Engineer"
                    value={formData.designation}
                    onChange={(e) =>
                      setFormData({ ...formData, designation: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="joinedDate">Joined Date</Label>
                  <Input
                    id="joinedDate"
                    type="date"
                    value={formData.joinedDate}
                    onChange={(e) =>
                      setFormData({ ...formData, joinedDate: e.target.value })
                    }
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked })
                    }
                  />
                  <Label htmlFor="isActive">Active Employee</Label>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Custom Schedule (Optional)</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Leave blank to use global settings
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="checkInTime">Check-in Time</Label>
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
                    <Label htmlFor="checkOutTime">Check-out Time</Label>
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
                      placeholder="8"
                      value={formData.requiredWorkHours}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requiredWorkHours: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Access Key Section */}
              <div className="border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Key className="h-5 w-5" />
                  <h3 className="text-lg font-medium">Access Key</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Employee uses this key along with Employee ID to log in.
                </p>
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Current Access Key</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={accessKey || ''}
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(accessKey || '')}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRegenerateKey}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <Link href="/dashboard/admin/employees">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
