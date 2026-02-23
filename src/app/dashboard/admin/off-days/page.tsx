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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CalendarDays, Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageLoader } from '@/components/ui/loader'

interface Employee {
  id: string
  name: string | null
  employeeId: string | null
}

interface OffDay {
  id: string
  date: string
  reason: string
  isPaid: boolean
  user: {
    id: string
    name: string | null
    employeeId: string | null
  }
}

export default function OffDaysPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [offDays, setOffDays] = useState<OffDay[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    userId: '',
    date: '',
    reason: '',
    isPaid: false,
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
      fetchData()
    }
  }, [session])

  const fetchData = async () => {
    try {
      const [offDaysRes, employeesRes] = await Promise.all([
        fetch('/api/off-days'),
        fetch('/api/employees?page=1&status=active'),
      ])

      if (offDaysRes.ok) {
        const data = await offDaysRes.json()
        setOffDays(data.offDays)
      }

      if (employeesRes.ok) {
        const data = await employeesRes.json()
        setEmployees(data.employees)
      }
    } catch (error) {
      toast.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.userId || !formData.date || !formData.reason) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/off-days', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create off day')
      }

      toast.success('Off day created successfully')
      setDialogOpen(false)
      setFormData({ userId: '', date: '', reason: '', isPaid: false })
      fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create off day')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (offDayId: string) => {
    if (!confirm('Are you sure you want to delete this off day?')) return

    try {
      const response = await fetch(`/api/off-days/${offDayId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete off day')
      }

      toast.success('Off day deleted')
      setOffDays(offDays.filter((od) => od.id !== offDayId))
    } catch (err: unknown) {
      toast.error('Failed to delete off day')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading off days..." />
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
            <h1 className="text-3xl font-bold">Off Days Management</h1>
            <p className="text-muted-foreground">
              Manage individual employee off days
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Off Day
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              All Off Days
            </CardTitle>
            <CardDescription>
              Individual off days assigned to employees
            </CardDescription>
          </CardHeader>
          <CardContent>
            {offDays.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No off days configured. Click "Add Off Day" to assign one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offDays.map((offDay) => (
                    <TableRow key={offDay.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{offDay.user.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {offDay.user.employeeId}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(offDay.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {offDay.reason}
                      </TableCell>
                      <TableCell>
                        <Badge variant={offDay.isPaid ? 'default' : 'secondary'}>
                          {offDay.isPaid ? 'Paid' : 'Unpaid'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(offDay.id)}
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
      </div>

      {/* Add Off Day Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Off Day</DialogTitle>
            <DialogDescription>
              Assign an off day to an employee
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Employee *</Label>
              <Select
                value={formData.userId}
                onValueChange={(value) =>
                  setFormData({ ...formData, userId: value })
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
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Reason for the off day"
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                required
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPaid"
                checked={formData.isPaid}
                onChange={(e) =>
                  setFormData({ ...formData, isPaid: e.target.checked })
                }
                className="h-4 w-4"
              />
              <Label htmlFor="isPaid" className="font-normal">
                This is a paid off day
              </Label>
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
                  !formData.userId ||
                  !formData.date ||
                  !formData.reason
                }
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Off Day
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
