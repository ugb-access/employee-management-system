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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Pencil, Mail, Briefcase, Clock, IdCard, Key, Copy, Check, RefreshCw, Loader2, Calendar, UserPlus } from 'lucide-react'
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
  createdAt: string
  settings: EmployeeSettings | null
}

export default function EmployeeDetailsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const employeeId = params.id as string

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)

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

      setEmployee(data.employee)
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

    setRegenerating(true)
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

      setEmployee(prev => prev ? { ...prev, accessKey: data.employee.accessKey } : null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate access key')
    } finally {
      setRegenerating(false)
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

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Link href="/dashboard/admin/employees">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Employees
            </Button>
          </Link>
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">
            {error}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!employee) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin/employees">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{employee.name}</h1>
              <p className="text-muted-foreground">{employee.designation}</p>
            </div>
          </div>
          <Link href={`/dashboard/admin/employees/${employee.id}/edit`}>
            <Button>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Employee
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Employee account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <IdCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Employee ID</p>
                  <p className="font-medium font-mono">{employee.employeeId}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{employee.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Designation</p>
                  <p className="font-medium">{employee.designation}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-4 w-4 flex items-center justify-center">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      employee.isActive ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                    {employee.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Joined Date</p>
                  <p className="font-medium">
                    {employee.joinedDate
                      ? new Date(employee.joinedDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'Not set'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Account Created</p>
                  <p className="font-medium">
                    {new Date(employee.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work Schedule</CardTitle>
              <CardDescription>
                {employee.settings
                  ? 'Custom schedule for this employee'
                  : 'Using global settings'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {employee.settings ? (
                <>
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Check-in Time</p>
                      <p className="font-medium">
                        {employee.settings.checkInTime || 'Not set'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Check-out Time</p>
                      <p className="font-medium">
                        {employee.settings.checkOutTime || 'Not set'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Required Hours</p>
                      <p className="font-medium">
                        {employee.settings.requiredWorkHours
                          ? `${employee.settings.requiredWorkHours} hours`
                          : 'Not set'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  This employee is using the global work schedule settings.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Access Key Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Login Credentials
              </CardTitle>
              <CardDescription>
                Employee uses these credentials to log in via Employee Login
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Employee ID</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={employee.employeeId || ''}
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(employee.employeeId || '')}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Access Key</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={employee.accessKey || ''}
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(employee.accessKey || '')}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleRegenerateKey}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Regenerate Access Key
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Warning: Regenerating will invalidate the old access key immediately.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
