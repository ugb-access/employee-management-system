import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { leaveRequestSchema } from '@/lib/validations'
import { getTodayPKT, getISOWeekday, isWorkingDay } from '@/lib/calculations'
import { NextResponse } from 'next/server'

// GET /api/leaves - List leaves (Admin: all, Employee: own)
export async function GET(req: Request) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')

    const where: {
      userId?: string
      status?: 'PENDING' | 'APPROVED' | 'REJECTED'
    } = {}

    // Employees can only see their own leaves
    if (session.user.role === 'EMPLOYEE') {
      where.userId = session.user.id
    } else if (userId) {
      // Admin can filter by user
      where.userId = userId
    }

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      where.status = status as 'PENDING' | 'APPROVED' | 'REJECTED'
    }

    // Fetch leaves and then manually fetch approver info
    const leavesData = await prisma.leave.findMany({
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
        createdAt: 'desc',
      },
    })

    // Get unique approver IDs and fetch their names
    const approverIds = leavesData
      .filter((leave) => leave.approvedBy)
      .map((leave) => leave.approvedBy as string)

    const approvers = approverIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: approverIds } },
          select: { id: true, name: true },
        })
      : []

    const approverMap = new Map(approvers.map((a) => [a.id, a]))

    // Attach approver info to leaves
    const leaves = leavesData.map((leave) => ({
      ...leave,
      approver: leave.approvedBy ? approverMap.get(leave.approvedBy) : null,
    }))

    return NextResponse.json({ leaves })
  } catch (error) {
    console.error('Get leaves error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaves' },
      { status: 500 }
    )
  }
}

// POST /api/leaves - Create leave request
export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validationResult = leaveRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    const validatedData = validationResult.data

    // Check if date is in the future (use PKT timezone for consistent comparison)
    const today = getTodayPKT()
    // Handle date - validatedData.date could be a Date object or string
    const dateValue = validatedData.date
    const leaveDate = dateValue instanceof Date
      ? new Date(dateValue.toISOString().split('T')[0] + 'T00:00:00.000Z')
      : new Date(dateValue + 'T00:00:00.000Z')

    // Compare dates by their time values (both are at midnight UTC)
    if (leaveDate.getTime() <= today.getTime()) {
      return NextResponse.json(
        { error: 'Leave date must be in the future' },
        { status: 400 }
      )
    }

    // Check if leave already exists for this date
    const existingLeave = await prisma.leave.findFirst({
      where: {
        userId: session.user.id,
        date: leaveDate,
        status: { not: 'REJECTED' },
      },
    })

    if (existingLeave) {
      return NextResponse.json(
        { error: 'Leave already requested for this date' },
        { status: 400 }
      )
    }

    // Check if it's a working day
    // Working days are stored as ISO weekdays (1=Monday, 7=Sunday)
    const globalSettings = await prisma.globalSettings.findFirst()
    if (globalSettings) {
      const workingDays = globalSettings.workingDays.split(',').map(Number)
      const isoWeekday = getISOWeekday(leaveDate)
      if (!workingDays.includes(isoWeekday)) {
        return NextResponse.json(
          { error: 'Selected date is not a working day' },
          { status: 400 }
        )
      }
    }

    // Check if it's a holiday
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: leaveDate,
        year: leaveDate.getFullYear(),
      },
    })

    if (holiday) {
      return NextResponse.json(
        { error: `Selected date is a holiday (${holiday.name})` },
        { status: 400 }
      )
    }

    const leave = await prisma.leave.create({
      data: {
        userId: session.user.id,
        date: leaveDate,
        reason: validatedData.reason,
        leaveType: validatedData.leaveType,
        status: 'PENDING',
        appliedBy: session.user.id,
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
      leave,
      message: 'Leave request submitted successfully',
    })
  } catch (error) {
    console.error('Create leave error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create leave request'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
