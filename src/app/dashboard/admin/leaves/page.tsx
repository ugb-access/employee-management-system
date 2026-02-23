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
import { Check, X, Clock, Loader2 } from 'lucide-react'
import { PageLoader } from '@/components/ui/loader'

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

export default function AdminLeavesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')

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
  }, [session, filter])

  const fetchLeaves = async () => {
    try {
      const statusParam = filter !== 'all' ? `?status=${filter}` : ''
      const response = await fetch(`/api/leaves${statusParam}`)
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

      // Refresh the list
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leave Management</h1>
            <p className="text-muted-foreground">
              Review and manage employee leave requests
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
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
    </DashboardLayout>
  )
}
