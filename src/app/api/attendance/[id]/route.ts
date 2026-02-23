import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { editAttendanceSchema } from '@/lib/validations'
import { calculateLateFine, calculateTotalHours } from '@/lib/calculations'
import { NextResponse } from 'next/server'

// GET /api/attendance/[id] - Get single attendance record
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            employeeId: true,
            settings: true,
          },
        },
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    // Employees can only view their own attendance
    if (session.user.role === 'EMPLOYEE' && attendance.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('Get attendance error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    )
  }
}

// PUT /api/attendance/[id] - Edit attendance (Admin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const validatedData = editAttendanceSchema.parse(body)

    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: {
        user: {
          include: { settings: true },
        },
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    // Get global settings for fine calculation
    const globalSettings = await prisma.globalSettings.findFirst()
    if (!globalSettings) {
      return NextResponse.json(
        { error: 'Global settings not configured' },
        { status: 500 }
      )
    }

    const userSettings = attendance.user.settings
    const settings = userSettings || globalSettings

    // Prepare update data
    const updateData: {
      checkInTime?: Date
      checkOutTime?: Date
      checkInReason?: string | null
      checkOutReason?: string | null
      lateMinutes?: number
      earlyMinutes?: number
      totalHours?: number
      fineAmount?: number
      isModifiedByAdmin?: boolean
    } = {
      isModifiedByAdmin: true,
    }

    // Handle check-in time update
    if (validatedData.checkInTime) {
      const [hours, minutes] = validatedData.checkInTime.split(':').map(Number)
      const newCheckIn = new Date(attendance.date)
      newCheckIn.setHours(hours, minutes, 0, 0)
      updateData.checkInTime = newCheckIn
      updateData.checkInReason = validatedData.checkInReason || attendance.checkInReason

      // Recalculate late fine
      const { lateMinutes, fineAmount } = calculateLateFine(
        newCheckIn,
        settings.checkInTime,
        globalSettings
      )
      updateData.lateMinutes = lateMinutes
      updateData.fineAmount = fineAmount
    }

    // Handle check-out time update
    if (validatedData.checkOutTime) {
      const [hours, minutes] = validatedData.checkOutTime.split(':').map(Number)
      const newCheckOut = new Date(attendance.date)
      newCheckOut.setHours(hours, minutes, 0, 0)
      updateData.checkOutTime = newCheckOut
      updateData.checkOutReason = validatedData.checkOutReason || attendance.checkOutReason

      // Recalculate early minutes
      if (settings.checkOutTime) {
        const [outHours, outMinutes] = settings.checkOutTime.split(':').map(Number)
        const scheduledCheckOut = new Date(attendance.date)
        scheduledCheckOut.setHours(outHours, outMinutes, 0, 0)

        const diffMs = scheduledCheckOut.getTime() - newCheckOut.getTime()
        if (diffMs > 0) {
          updateData.earlyMinutes = Math.floor(diffMs / (1000 * 60))
        } else {
          updateData.earlyMinutes = 0
        }
      }
    }

    // Recalculate total hours if both times are available
    const finalCheckIn = updateData.checkInTime || attendance.checkInTime
    const finalCheckOut = updateData.checkOutTime || attendance.checkOutTime

    if (finalCheckIn && finalCheckOut) {
      updateData.totalHours = calculateTotalHours(finalCheckIn, finalCheckOut)
    }

    const updatedAttendance = await prisma.attendance.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      attendance: updatedAttendance,
      message: 'Attendance updated successfully',
    })
  } catch (error) {
    console.error('Update attendance error:', error)
    return NextResponse.json(
      { error: 'Failed to update attendance' },
      { status: 500 }
    )
  }
}
