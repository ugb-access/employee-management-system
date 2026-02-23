import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateLateFine, isWorkingDay, getTodayPKT, getNowPKT } from '@/lib/calculations'
import { checkInSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { reason } = checkInSchema.parse(body)

    const today = getTodayPKT()

    // Check if already checked in
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
          date: today,
        },
      },
    })

    if (existingAttendance?.checkInTime) {
      return NextResponse.json(
        { error: 'Already checked in today' },
        { status: 400 }
      )
    }

    // Get user settings or global settings
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
    const workingDays = globalSettings.workingDays.split(',').map(Number)

    // Check if today is a working day
    if (!isWorkingDay(today, workingDays)) {
      return NextResponse.json(
        { error: 'Cannot check in on a non-working day' },
        { status: 400 }
      )
    }

    // Check if today is a holiday
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: today,
        year: today.getFullYear(),
      },
    })

    if (holiday) {
      return NextResponse.json(
        { error: `Today is ${holiday.name} (holiday). Cannot check in.` },
        { status: 400 }
      )
    }

    // Check if user has an off day
    const offDay = await prisma.offDay.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
          date: today,
        },
      },
    })

    if (offDay) {
      return NextResponse.json(
        { error: 'You have an off day today. Cannot check in.' },
        { status: 400 }
      )
    }

    // Calculate late fine using PKT time
    const checkInTime = getNowPKT()
    const settingsData = {
      ...globalSettings,
      workingDays: globalSettings.workingDays.split(',').map(Number),
    }
    const { lateMinutes, fineAmount } = calculateLateFine(
      checkInTime,
      settings.checkInTime,
      settingsData
    )

    // TODO: Re-enable 12 PM check-in restriction after testing
    // const currentHour = checkInTime.getHours()
    // if (currentHour >= 12) {
    //   return NextResponse.json(
    //     { error: 'Check-in is not allowed after 12:00 PM' },
    //     { status: 400 }
    //   )
    // }

    // Require reason for late check-in
    if (lateMinutes > 0 && !reason) {
      return NextResponse.json(
        { error: 'Reason is required for late check-in' },
        { status: 400 }
      )
    }

    // Create attendance record
    const attendance = await prisma.attendance.create({
      data: {
        userId: session.user.id,
        date: today,
        checkInTime,
        checkInReason: reason || null,
        lateMinutes,
        fineAmount,
      },
    })

    return NextResponse.json({
      success: true,
      attendance,
      message: lateMinutes > 0
        ? `Checked in ${lateMinutes} minutes late. Fine: Rs.${fineAmount}`
        : 'Checked in successfully',
    })
  } catch (error) {
    console.error('Check-in error:', error)
    return NextResponse.json(
      { error: 'Failed to check in' },
      { status: 500 }
    )
  }
}
