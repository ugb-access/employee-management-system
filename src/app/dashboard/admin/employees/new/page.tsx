'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, Copy, Check } from 'lucide-react'
import { PageLoader } from '@/components/ui/loader'

interface CreatedCredentials {
  employeeId: string
  accessKey: string
}

export default function NewEmployeePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    designation: '',
    joinedDate: '',
    checkInTime: '',
    checkOutTime: '',
    requiredWorkHours: '',
  })

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      console.error('Failed to copy')
    }
  }

  const handleCreateAnother = () => {
    setShowCredentialsDialog(false)
    setCreatedCredentials(null)
    setFormData({
      name: '',
      email: '',
      password: '',
      designation: '',
      joinedDate: '',
      checkInTime: '',
      checkOutTime: '',
      requiredWorkHours: '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          designation: formData.designation,
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
        throw new Error(data.error || 'Failed to create employee')
      }

      // Show credentials dialog
      setCreatedCredentials({
        employeeId: data.employee.employeeId,
        accessKey: data.employee.accessKey,
      })
      setShowCredentialsDialog(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create employee')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <PageLoader text="Loading..." />
      </DashboardLayout>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    router.push('/dashboard/employee')
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
            <h1 className="text-3xl font-bold">Add Employee</h1>
            <p className="text-muted-foreground">
              Create a new employee account
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
              Enter the details for the new employee. Employee ID and Access Key will be auto-generated.
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
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    minLength={6}
                  />
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
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use account creation date
                  </p>
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

              <div className="flex justify-end gap-4">
                <Link href="/dashboard/admin/employees">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Employee
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Employee Created Successfully!</DialogTitle>
            <DialogDescription>
              Save these credentials. The employee will need them to log in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Employee ID</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={createdCredentials?.employeeId || ''}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(createdCredentials?.employeeId || '', 'employeeId')}
                >
                  {copiedField === 'employeeId' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Access Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={createdCredentials?.accessKey || ''}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(createdCredentials?.accessKey || '', 'accessKey')}
                >
                  {copiedField === 'accessKey' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-muted p-3 rounded-md text-sm text-muted-foreground">
              <strong>Note:</strong> The employee can log in using Employee Login on the login page with these credentials.
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCreateAnother}>
                Create Another
              </Button>
              <Button onClick={() => router.push('/dashboard/admin/employees')}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
