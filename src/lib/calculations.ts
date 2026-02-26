import { differenceInMinutes, format } from 'date-fns'
import type { GlobalSettingsData } from '@/types'

const PKT_TIMEZONE = 'Asia/Karachi'

/**
 * Get today's date at midnight in PKT timezone.
 * Returns a Date object with the PKT date (year/month/day) set at 00:00:00 UTC
 * so that PostgreSQL @db.Date stores the correct calendar date.
 */
export function getTodayPKT(): Date {
  const now = new Date()
  // Get date parts in PKT
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const pktDateStr = formatter.format(now) // "YYYY-MM-DD"
  // Create a date at midnight UTC with the PKT calendar date
  return new Date(pktDateStr + 'T00:00:00.000Z')
}

/**
 * Get current time in PKT as a Date object.
 * Returns a UTC Date that represents the PKT time correctly.
 * PKT is UTC+5, so if it's 10:00 PKT, we store 05:00 UTC.
 * When displayed with formatTime (PKT timezone), it shows the correct time.
 */
export function getNowPKT(): Date {
  const now = new Date()
  const pktParts = new Intl.DateTimeFormat('en-US', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) => pktParts.find(p => p.type === type)?.value || '0'
  const year = parseInt(get('year'))
  const month = parseInt(get('month')) - 1  // JavaScript months are 0-indexed
  const day = parseInt(get('day'))
  const hour = parseInt(get('hour'))
  const minute = parseInt(get('minute'))
  const second = parseInt(get('second'))

  // Create UTC date directly using Date.UTC
  // PKT is UTC+5, so subtract 5 hours from PKT time to get UTC
  let utcHour = hour - 5
  let utcDay = day
  let utcMonth = month
  let utcYear = year

  // Handle day rollover
  if (utcHour < 0) {
    utcHour += 24
    utcDay -= 1
    // Handle month/year rollover if needed
    if (utcDay < 1) {
      utcMonth -= 1
      if (utcMonth < 0) {
        utcMonth = 11
        utcYear -= 1
      }
      // Get last day of previous month
      utcDay = new Date(utcYear, utcMonth + 1, 0).getDate()
    }
  }

  return new Date(Date.UTC(utcYear, utcMonth, utcDay, utcHour, minute, second))
}

/**
 * Calculate late arrival fine
 * Grace period: no fine if within grace period minutes
 * Base fine + additional fine per 30 minutes after grace period
 */
export function calculateLateFine(
  checkInTime: Date,
  assignedCheckInTime: string,
  settings: GlobalSettingsData
): { lateMinutes: number; fineAmount: number } {
  const [hours, minutes] = assignedCheckInTime.split(':').map(Number)
  const assignedTime = new Date(checkInTime)
  assignedTime.setHours(hours, minutes, 0, 0)

  const lateMinutes = Math.max(0, differenceInMinutes(checkInTime, assignedTime))
  const gracePeriod = settings.gracePeriodMinutes ?? 0

  // If within grace period, no fine
  if (lateMinutes <= gracePeriod) {
    return { lateMinutes, fineAmount: 0 }
  }

  // Calculate fine based on minutes after grace period
  const minutesAfterGrace = lateMinutes - gracePeriod

  // Base fine + additional fine for every 30 minutes after grace period
  const fineAmount = settings.lateFineBase + Math.floor(minutesAfterGrace / 30) * settings.lateFinePer30Min

  return { lateMinutes, fineAmount }
}

/**
 * Calculate early checkout minutes
 */
export function calculateEarlyMinutes(
  checkOutTime: Date,
  assignedCheckOutTime: string
): number {
  const [hours, minutes] = assignedCheckOutTime.split(':').map(Number)
  const assignedTime = new Date(checkOutTime)
  assignedTime.setHours(hours, minutes, 0, 0)

  return Math.max(0, differenceInMinutes(assignedTime, checkOutTime))
}

/**
 * Calculate total hours worked
 */
export function calculateTotalHours(checkInTime: Date, checkOutTime: Date | null): number {
  if (!checkOutTime) return 0
  return differenceInMinutes(checkOutTime, checkInTime) / 60
}

/**
 * Check if work hours are incomplete
 */
export function isWorkHoursIncomplete(
  totalHours: number,
  requiredHours: number
): { isIncomplete: boolean; deficiencyHours: number } {
  const deficiencyHours = Math.max(0, requiredHours - totalHours)
  return {
    isIncomplete: deficiencyHours > 0,
    deficiencyHours: Math.round(deficiencyHours * 100) / 100
  }
}

/**
 * Calculate leave cost and determine leave zone
 */
export function calculateLeaveDetails(
  leavesThisMonth: number,
  paidLeavesUsed: number,
  settings: GlobalSettingsData
): {
  isPaid: boolean
  cost: number
  zone: 'NORMAL' | 'WARNING' | 'DANGER'
} {
  // Check if this leave should be paid
  const isPaid = paidLeavesUsed < settings.paidLeavesPerMonth

  // Calculate cost for unpaid leaves
  const unpaidLeaves = Math.max(0, leavesThisMonth - settings.paidLeavesPerMonth)
  const cost = unpaidLeaves * settings.leaveCost

  // Determine leave zone
  let zone: 'NORMAL' | 'WARNING' | 'DANGER' = 'NORMAL'
  if (leavesThisMonth >= settings.dangerLeaveCount) {
    zone = 'DANGER'
  } else if (leavesThisMonth >= settings.warningLeaveCount) {
    zone = 'WARNING'
  }

  return { isPaid, cost, zone }
}

/**
 * Check if a given date is a working day
 */
export function isWorkingDay(date: Date, workingDays: number[]): boolean {
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  // Convert to ISO weekday (1=Monday, 7=Sunday)
  const isoWeekday = date.getDay() === 0 ? 7 : date.getDay()
  return workingDays.includes(isoWeekday)
}

/**
 * Format time for display in PKT timezone (12-hour format)
 */
export function formatTime(date: Date | string | null): string {
  if (!date) return '--:--'
  // Always display in PKT timezone with 12-hour format
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PKT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date))
}

/**
 * Extract time string (HH:MM) in PKT timezone from a UTC date
 * Use this for populating time input fields in forms
 */
export function formatTimeForInput(date: Date | string | null): string {
  if (!date) return ''
  const d = new Date(date)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PKT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const hour = parts.find(p => p.type === 'hour')?.value || '00'
  const minute = parts.find(p => p.type === 'minute')?.value || '00'

  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

/**
 * Parse time string to Date object
 */
export function parseTimeString(timeStr: string, date: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

/**
 * Check if user can still edit their attendance (within 15 minutes)
 */
export function canEditAttendance(attendanceTime: Date, now: Date = new Date()): boolean {
  const diffMinutes = Math.abs(differenceInMinutes(now, attendanceTime))
  return diffMinutes <= 15
}

/**
 * Format a Date object as YYYY-MM-DD in local timezone (not UTC)
 * Use this for date input min/max attributes to avoid timezone offset issues
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Convert JavaScript getDay() (0=Sunday, 1=Monday) to ISO weekday (1=Monday, 7=Sunday)
 * Working days in settings are stored as ISO weekdays (1-7)
 */
export function getISOWeekday(date: Date): number {
  return date.getDay() === 0 ? 7 : date.getDay()
}

/**
 * Compare two dates by their calendar date parts only (ignoring time)
 * Both dates should be Date objects, comparison uses UTC to match database storage
 */
export function isSameCalendarDate(date1: Date, date2: Date): boolean {
  return date1.getUTCFullYear() === date2.getUTCFullYear() &&
         date1.getUTCMonth() === date2.getUTCMonth() &&
         date1.getUTCDate() === date2.getUTCDate()
}
