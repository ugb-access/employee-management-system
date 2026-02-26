import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const createEmployeeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  designation: z.string().min(2, 'Designation is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  joinedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  requiredWorkHours: z.number().min(1).max(24).optional(),
})

export const employeeLoginSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  accessKey: z.string().min(1, 'Access key is required'),
})

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  id: z.string(),
  isActive: z.boolean().optional(),
  regenerateAccessKey: z.boolean().optional(),
})

export const checkInSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters').optional(),
})

export const checkOutSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
})

export const editAttendanceSchema = z.object({
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  checkInReason: z.string().optional(),
  checkOutReason: z.string().optional(),
})

export const leaveRequestSchema = z.object({
  date: z.coerce.date(),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  leaveType: z.enum(['PAID', 'UNPAID', 'SICK', 'CASUAL']).optional().default('UNPAID'),
})

export const approveLeaveSchema = z.object({
  leaveId: z.string(),
  status: z.enum(['APPROVED', 'REJECTED']),
})

export const globalSettingsSchema = z.object({
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
  requiredWorkHours: z.number().min(1).max(24),
  lateFineBase: z.number().min(0),
  lateFinePer30Min: z.number().min(0),
  leaveCost: z.number().min(0),
  paidLeavesPerMonth: z.number().min(0).max(31),
  warningLeaveCount: z.number().min(0).max(31),
  dangerLeaveCount: z.number().min(0).max(31),
  workingDays: z.array(z.number().min(1).max(7)),
})

export const holidaySchema = z.object({
  name: z.string().min(2, 'Holiday name is required'),
  date: z.coerce.date(),
  isRecurring: z.boolean().default(false),
})

export const offDaySchema = z.object({
  userId: z.string(),
  date: z.coerce.date(),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  isPaid: z.boolean().default(false),
})

export type LoginInput = z.infer<typeof loginSchema>
export type EmployeeLoginInput = z.infer<typeof employeeLoginSchema>
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>
export type CheckInInput = z.infer<typeof checkInSchema>
export type CheckOutInput = z.infer<typeof checkOutSchema>
export type EditAttendanceInput = z.infer<typeof editAttendanceSchema>
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>
export type GlobalSettingsInput = z.infer<typeof globalSettingsSchema>
export type HolidayInput = z.infer<typeof holidaySchema>
export type OffDayInput = z.infer<typeof offDaySchema>
