import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { offDaySchema } from '@/lib/validations'
import { NextResponse } from 'next/server'

// GET /api/off-days - List off days
export async function GET(req: Request) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const where: {
      userId?: string
      date?: { gte: Date; lte: Date }
    } = {}

    // Employees can only see their own off days
    if (session.user.role === 'EMPLOYEE') {
      where.userId = session.user.id
    } else if (userId) {
      where.userId = userId
    }

    // Filter by month and year
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
      const endDate = new Date(parseInt(year), parseInt(month), 0)
      where.date = { gte: startDate, lte: endDate }
    }

    const offDays = await prisma.offDay.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    return NextResponse.json({ offDays })
  } catch (error) {
    console.error('Get off-days error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch off-days' },
      { status: 500 }
    )
  }
}

// POST /api/off-days - Create off day (Admin only)
export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = offDaySchema.parse(body)

    const offDayDate = new Date(validatedData.date)
    offDayDate.setHours(0, 0, 0, 0)

    // Check if off day already exists for this user and date
    const existingOffDay = await prisma.offDay.findUnique({
      where: {
        userId_date: {
          userId: validatedData.userId,
          date: offDayDate,
        },
      },
    })

    if (existingOffDay) {
      return NextResponse.json(
        { error: 'Off day already exists for this date' },
        { status: 400 }
      )
    }

    // Check if attendance exists for this date
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId: validatedData.userId,
          date: offDayDate,
        },
      },
    })

    if (existingAttendance) {
      return NextResponse.json(
        { error: 'Attendance already exists for this date. Delete attendance first.' },
        { status: 400 }
      )
    }

    const offDay = await prisma.offDay.create({
      data: {
        userId: validatedData.userId,
        date: offDayDate,
        reason: validatedData.reason,
        isPaid: validatedData.isPaid,
      },
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
      offDay,
      message: 'Off day created successfully',
    })
  } catch (error) {
    console.error('Create off-day error:', error)
    return NextResponse.json(
      { error: 'Failed to create off-day' },
      { status: 500 }
    )
  }
}
