import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { leaveRequestSchema, adminLeaveCreateSchema } from '@/lib/validations'
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: {
      userId?: string
      status?: 'PENDING' | 'APPROVED' | 'REJECTED'
      date?: { gte: Date; lte: Date }
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

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate + 'T00:00:00.000Z'),
        lte: new Date(endDate + 'T00:00:00.000Z'),
      }
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
        date: 'desc',
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

    // Return annual balance for employees (always current year, ignores date filter)
    let annualBalance = null
    if (session.user.role === 'EMPLOYEE') {
      const currentYear = new Date().getUTCFullYear()
      const yearStart = new Date(`${currentYear}-01-01T00:00:00.000Z`)
      const yearEnd = new Date(`${currentYear}-12-31T23:59:59.999Z`)
      const [annualUsed, globalSettings] = await Promise.all([
        prisma.leave.count({
          where: {
            userId: session.user.id,
            status: 'APPROVED',
            date: { gte: yearStart, lte: yearEnd },
          },
        }),
        prisma.globalSettings.findFirst(),
      ])
      const limit = globalSettings?.annualLeavesPerYear ?? 12
      annualBalance = { used: annualUsed, limit, remaining: Math.max(0, limit - annualUsed) }
    }

    return NextResponse.json({ leaves, annualBalance })
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

    // Admin path: immediately approved, past dates allowed, picks any employee
    if (session.user.role === 'ADMIN') {
      const validationResult = adminLeaveCreateSchema.safeParse(body)
      if (!validationResult.success) {
        return NextResponse.json(
          { error: validationResult.error.issues[0].message },
          { status: 400 }
        )
      }

      const validatedData = validationResult.data
      const leaveDate = new Date(validatedData.date.toISOString().split('T')[0] + 'T00:00:00.000Z')

      // Check if leave already exists for this date
      const existingLeave = await prisma.leave.findFirst({
        where: {
          userId: validatedData.userId,
          date: leaveDate,
          status: { not: 'REJECTED' },
        },
      })
      if (existingLeave) {
        return NextResponse.json(
          { error: 'Leave already exists for this date' },
          { status: 400 }
        )
      }

      // Block if attendance already recorded for that day
      const existingAttendance = await prisma.attendance.findUnique({
        where: {
          userId_date: { userId: validatedData.userId, date: leaveDate },
        },
      })
      if (existingAttendance) {
        return NextResponse.json(
          { error: 'Employee already has an attendance record for this date' },
          { status: 400 }
        )
      }

      const leave = await prisma.leave.create({
        data: {
          userId: validatedData.userId,
          date: leaveDate,
          reason: validatedData.reason,
          leaveType: validatedData.leaveType,
          status: 'APPROVED',
          appliedBy: session.user.id,
          approvedBy: session.user.id,
          approvedAt: new Date(),
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      return NextResponse.json({
        success: true,
        leave,
        message: 'Leave created and approved',
      })
    }

    // Employee path: future dates only, pending status
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

    // Check monthly and annual leave limits to generate warnings
    const warnings: string[] = []
    if (globalSettings) {
      const paidLeavesPerMonth = globalSettings.paidLeavesPerMonth
      const annualLeavesPerYear = globalSettings.annualLeavesPerYear ?? 12

      const monthStart = new Date(Date.UTC(leaveDate.getUTCFullYear(), leaveDate.getUTCMonth(), 1))
      const monthEnd = new Date(Date.UTC(leaveDate.getUTCFullYear(), leaveDate.getUTCMonth() + 1, 0))
      const yearStart = new Date(`${leaveDate.getUTCFullYear()}-01-01T00:00:00.000Z`)
      const yearEnd = new Date(`${leaveDate.getUTCFullYear()}-12-31T23:59:59.999Z`)

      const [monthlyUsed, annualUsed] = await Promise.all([
        prisma.leave.count({
          where: {
            userId: session.user.id,
            status: 'APPROVED',
            date: { gte: monthStart, lte: monthEnd },
          },
        }),
        prisma.leave.count({
          where: {
            userId: session.user.id,
            status: 'APPROVED',
            date: { gte: yearStart, lte: yearEnd },
          },
        }),
      ])

      if (annualUsed >= annualLeavesPerYear) {
        warnings.push(
          `Annual leave pool exhausted (${annualUsed}/${annualLeavesPerYear} used). This leave is unpaid and a deduction of Rs.${globalSettings.leaveCost} will apply.`
        )
      } else if (monthlyUsed >= paidLeavesPerMonth) {
        warnings.push(
          `Monthly free leaves used (${monthlyUsed}/${paidLeavesPerMonth} this month). This leave will be deducted from your annual pool (${annualUsed + 1}/${annualLeavesPerYear} after this).`
        )
      }
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
      warnings,
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
