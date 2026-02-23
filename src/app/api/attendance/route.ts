import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateLateFine, calculateEarlyMinutes, calculateTotalHours, getTodayPKT } from '@/lib/calculations'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const manualAttendanceSchema = z.object({
  userId: z.string(),
  date: z.string(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  checkInReason: z.string().optional(),
  checkOutReason: z.string().optional(),
})

// GET /api/attendance - List attendance records
export async function GET(req: Request) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const userId = searchParams.get('userId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    // Employees can only see their own attendance
    if (session.user.role === 'EMPLOYEE') {
      where.userId = session.user.id
    } else if (userId) {
      where.userId = userId
    }

    // Filter by specific date
    if (date) {
      // Parse as UTC date to match @db.Date storage
      where.date = new Date(date + 'T00:00:00.000Z')
    }

    // Filter by custom date range (takes priority over month/year)
    if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam + 'T00:00:00.000Z')
      const endDate = new Date(endDateParam + 'T00:00:00.000Z')
      where.AND = [
        { date: { gte: startDate } },
        { date: { lte: endDate } },
      ]
    } else if (month && year) {
      // Filter by month and year - construct UTC dates
      const m = parseInt(month)
      const y = parseInt(year)
      const startDate = new Date(Date.UTC(y, m - 1, 1))
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
      const endDate = new Date(Date.UTC(y, m - 1, lastDay))
      where.AND = [
        { date: { gte: startDate } },
        { date: { lte: endDate } },
      ]
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            employeeId: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('Get attendance error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    )
  }
}

// POST /api/attendance - Create manual attendance (Admin only)
export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = manualAttendanceSchema.parse(body)

    // Parse date
    const attendanceDate = new Date(validatedData.date)
    attendanceDate.setHours(0, 0, 0, 0)

    // Check if attendance already exists for this user and date
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId: validatedData.userId,
          date: attendanceDate,
        },
      },
    })

    if (existingAttendance) {
      return NextResponse.json(
        { error: 'Attendance already exists for this date. Use edit instead.' },
        { status: 400 }
      )
    }

    // Get user settings and global settings
    const user = await prisma.user.findUnique({
      where: { id: validatedData.userId },
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

    // Parse check-in time
    const [inHours, inMinutes] = validatedData.checkInTime.split(':').map(Number)
    const checkInTime = new Date(attendanceDate)
    checkInTime.setHours(inHours, inMinutes, 0, 0)

    // Calculate late fine
    const settingsData = {
      ...globalSettings,
      workingDays: globalSettings.workingDays.split(',').map(Number),
    }
    const { lateMinutes, fineAmount } = calculateLateFine(
      checkInTime,
      settings.checkInTime,
      settingsData
    )

    // Prepare attendance data
    const attendanceData: {
      userId: string
      date: Date
      checkInTime: Date
      checkInReason: string | null
      lateMinutes: number
      fineAmount: number
      isModifiedByAdmin: boolean
      checkOutTime?: Date
      checkOutReason?: string
      earlyMinutes?: number
      totalHours?: number
    } = {
      userId: validatedData.userId,
      date: attendanceDate,
      checkInTime,
      checkInReason: validatedData.checkInReason || null,
      lateMinutes,
      fineAmount,
      isModifiedByAdmin: true,
    }

    // Handle check-out time if provided
    if (validatedData.checkOutTime) {
      const [outHours, outMinutes] = validatedData.checkOutTime.split(':').map(Number)
      const checkOutTime = new Date(attendanceDate)
      checkOutTime.setHours(outHours, outMinutes, 0, 0)

      attendanceData.checkOutTime = checkOutTime
      attendanceData.checkOutReason = validatedData.checkOutReason

      // Calculate early minutes
      const earlyMinutes = calculateEarlyMinutes(checkOutTime, settings.checkOutTime)
      attendanceData.earlyMinutes = earlyMinutes

      // Calculate total hours
      const totalHours = calculateTotalHours(checkInTime, checkOutTime)
      attendanceData.totalHours = totalHours
    }

    // Create attendance record
    const attendance = await prisma.attendance.create({
      data: attendanceData,
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
      attendance,
      message: 'Attendance created successfully',
    })
  } catch (error) {
    console.error('Create attendance error:', error)
    return NextResponse.json(
      { error: 'Failed to create attendance' },
      { status: 500 }
    )
  }
}
