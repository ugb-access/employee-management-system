import { Role, LeaveType, LeaveStatus } from '@prisma/client'

export type { Role, LeaveType, LeaveStatus }

export interface AttendanceRecord {
  id: string
  userId: string
  date: Date
  checkInTime: Date | null
  checkOutTime: Date | null
  checkInReason: string | null
  checkOutReason: string | null
  lateMinutes: number
  earlyMinutes: number
  totalHours: number
  fineAmount: number
  isAutoLeave: boolean
  isModifiedByAdmin: boolean
}

export interface LeaveRecord {
  id: string
  userId: string
  date: Date
  reason: string
  leaveType: LeaveType
  status: LeaveStatus
  appliedBy: string
  requestedAt: Date
  approvedBy: string | null
  approvedAt: Date | null
  isPaid: boolean
}

export interface EmployeeStats {
  userId: string
  userName: string
  month: number
  year: number
  totalPresent: number
  totalAbsent: number
  totalLeaves: number
  totalLate: number
  totalEarlyCheckout: number
  totalFines: number
  leaveZone: 'NORMAL' | 'WARNING' | 'DANGER'
  avgHoursPerDay: number
  incompleteDays: number
}

export interface GlobalSettingsData {
  checkInTime: string
  checkOutTime: string
  requiredWorkHours: number
  lateFineBase: number
  lateFinePer30Min: number
  leaveCost: number
  paidLeavesPerMonth: number
  warningLeaveCount: number
  dangerLeaveCount: number
  workingDays: number[]
}
