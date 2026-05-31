import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTodayPKT, getISOWeekday } from '@/lib/calculations'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const batchLeaveSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  leaveType: z.enum(['PAID', 'UNPAID', 'SICK', 'CASUAL']).default('UNPAID'),
  userId: z.string().optional(), // admin only
})

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const result = batchLeaveSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { startDate, endDate, reason, leaveType, userId: bodyUserId } = result.data
    const isAdmin = session.user.role === 'ADMIN'
    const targetUserId = isAdmin && bodyUserId ? bodyUserId : session.user.id

    const start = new Date(startDate + 'T00:00:00.000Z')
    const end = new Date(endDate + 'T00:00:00.000Z')

    if (start > end) {
      return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 })
    }

    // Max 90 days per batch
    const dayDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (dayDiff > 90) {
      return NextResponse.json({ error: 'Date range cannot exceed 90 days' }, { status: 400 })
    }

    const [globalSettings, holidays] = await Promise.all([
      prisma.globalSettings.findFirst(),
      prisma.holiday.findMany({ where: { date: { gte: start, lte: end } } }),
    ])

    const workingDays = globalSettings?.workingDays.split(',').map(Number) ?? [1, 2, 3, 4, 5]
    const holidayDateSet = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))
    const today = getTodayPKT()

    // Build candidate dates
    const candidates: Date[] = []
    const skipped: { date: string; reason: string }[] = []

    const cur = new Date(start)
    while (cur.getTime() <= end.getTime()) {
      const dateStr = cur.toISOString().split('T')[0]
      const isoWeekday = getISOWeekday(cur)

      if (!workingDays.includes(isoWeekday)) {
        skipped.push({ date: dateStr, reason: 'Weekend / non-working day' })
      } else if (holidayDateSet.has(dateStr)) {
        skipped.push({ date: dateStr, reason: 'Public holiday' })
      } else if (!isAdmin && cur.getTime() <= today.getTime()) {
        skipped.push({ date: dateStr, reason: 'Past date' })
      } else {
        candidates.push(new Date(cur))
      }
      cur.setUTCDate(cur.getUTCDate() + 1)
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'No valid working days in the selected range' },
        { status: 400 }
      )
    }

    // Remove dates that already have a leave
    const existing = await prisma.leave.findMany({
      where: { userId: targetUserId, date: { in: candidates }, status: { not: 'REJECTED' } },
    })
    const existingSet = new Set(existing.map(l => l.date.toISOString().split('T')[0]))

    let valid = candidates.filter(d => {
      const str = d.toISOString().split('T')[0]
      if (existingSet.has(str)) {
        skipped.push({ date: str, reason: 'Leave already exists' })
        return false
      }
      return true
    })

    if (valid.length === 0) {
      return NextResponse.json(
        { error: 'Leaves already exist for all selected working days' },
        { status: 400 }
      )
    }

    // Admin: also remove dates that have attendance records
    if (isAdmin) {
      const attendance = await prisma.attendance.findMany({
        where: { userId: targetUserId, date: { in: valid } },
      })
      const attSet = new Set(attendance.map(a => a.date.toISOString().split('T')[0]))
      valid = valid.filter(d => {
        const str = d.toISOString().split('T')[0]
        if (attSet.has(str)) {
          skipped.push({ date: str, reason: 'Attendance record exists' })
          return false
        }
        return true
      })

      if (valid.length === 0) {
        return NextResponse.json(
          { error: 'Attendance records exist for all selected dates' },
          { status: 400 }
        )
      }

      const leaves = await prisma.$transaction(
        valid.map(date =>
          prisma.leave.create({
            data: {
              userId: targetUserId,
              date,
              reason,
              leaveType,
              status: 'APPROVED',
              appliedBy: session.user.id,
              approvedBy: session.user.id,
              approvedAt: new Date(),
            },
          })
        )
      )

      return NextResponse.json({
        success: true,
        leaves,
        skipped,
        message: `${leaves.length} leave(s) created and approved`,
      })
    }

    // Employee path: warnings
    const warnings: string[] = []
    if (globalSettings) {
      const annualLeavesPerYear = globalSettings.annualLeavesPerYear ?? 12
      const currentYear = new Date().getUTCFullYear()
      const yearStart = new Date(`${currentYear}-01-01T00:00:00.000Z`)
      const yearEnd = new Date(`${currentYear}-12-31T23:59:59.999Z`)
      const annualUsed = await prisma.leave.count({
        where: { userId: targetUserId, status: 'APPROVED', date: { gte: yearStart, lte: yearEnd } },
      })
      if (annualUsed + valid.length > annualLeavesPerYear) {
        warnings.push(
          `This will exceed your annual leave pool (${annualUsed}/${annualLeavesPerYear} used). Some or all leaves will be unpaid with a deduction of Rs.${globalSettings.leaveCost} each.`
        )
      }
    }

    const leaves = await prisma.$transaction(
      valid.map(date =>
        prisma.leave.create({
          data: {
            userId: targetUserId,
            date,
            reason,
            leaveType,
            status: 'PENDING',
            appliedBy: session.user.id,
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      leaves,
      skipped,
      warnings,
      message: `${leaves.length} leave request(s) submitted`,
    })
  } catch (error) {
    console.error('Batch leave error:', error)
    return NextResponse.json({ error: 'Failed to create leave requests' }, { status: 500 })
  }
}
