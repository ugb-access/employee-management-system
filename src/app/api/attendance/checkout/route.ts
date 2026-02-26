import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateEarlyMinutes, calculateTotalHours, isWorkHoursIncomplete, getTodayPKT, getNowPKT } from '@/lib/calculations'
import { checkOutSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { reason } = checkOutSchema.parse(body)

    const today = getTodayPKT()

    // Get today's attendance
    const attendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
          date: today,
        },
      },
    })

    if (!attendance?.checkInTime) {
      return NextResponse.json(
        { error: 'Not checked in today' },
        { status: 400 }
      )
    }

    if (attendance.checkOutTime) {
      return NextResponse.json(
        { error: 'Already checked out today' },
        { status: 400 }
      )
    }

    // Get user settings
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { settings: true },
    })

    const globalSettings = await prisma.globalSettings.findFirst()

    if (!globalSettings) {
      return NextResponse.json(
        { error: 'Global settings not configured' },
        { status: 500 }
      )
    }

    const settings = user?.settings || globalSettings
    const requiredWorkHours = settings.requiredWorkHours || globalSettings.requiredWorkHours

    // Calculate check out time in PKT
    const checkOutTime = getNowPKT()

    // Calculate early checkout
    const earlyMinutes = calculateEarlyMinutes(
      checkOutTime,
      settings.checkOutTime
    )

    // Require reason for early checkout
    if (earlyMinutes > 0 && !reason) {
      return NextResponse.json(
        { error: 'Reason is required for early checkout', earlyMinutes, requiresReason: true },
        { status: 400 }
      )
    }

    // Calculate total hours
    const totalHours = calculateTotalHours(
      new Date(attendance.checkInTime),
      checkOutTime
    )

    // Check if work hours are incomplete
    const { isIncomplete, deficiencyHours } = isWorkHoursIncomplete(
      totalHours,
      requiredWorkHours
    )

    // Update attendance record
    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOutTime,
        checkOutReason: reason,
        earlyMinutes,
        totalHours,
      },
    })

    return NextResponse.json({
      success: true,
      attendance: updatedAttendance,
      message: isIncomplete
        ? `Checked out. Warning: You worked ${deficiencyHours} hours less than required (${requiredWorkHours}h)`
        : 'Checked out successfully',
    })
  } catch (error) {
    console.error('Check-out error:', error)
    return NextResponse.json(
      { error: 'Failed to check out' },
      { status: 500 }
    )
  }
}
