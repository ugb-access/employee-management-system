import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createEmployeeSchema } from '@/lib/validations'
import { generateAccessKey, generateEmployeeId } from '@/lib/access-key'
import { hash } from 'bcryptjs'
import { NextResponse } from 'next/server'

const PAGE_SIZE = 10

// GET /api/employees - List all employees with pagination and search
export async function GET(req: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') // 'active', 'inactive', or null for all

    const skip = (page - 1) * PAGE_SIZE

    // Build where clause
    const where: {
      role: 'EMPLOYEE'
      isActive?: boolean
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' }
        email?: { contains: string; mode: 'insensitive' }
        employeeId?: { contains: string; mode: 'insensitive' }
      }>
    } = {
      role: 'EMPLOYEE',
    }

    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Get total count for pagination
    const total = await prisma.user.count({ where })
    const totalPages = Math.ceil(total / PAGE_SIZE)

    const employees = await prisma.user.findMany({
      where,
      include: {
        settings: true,
        _count: {
          select: {
            attendance: true,
            leaves: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: PAGE_SIZE,
    })

    return NextResponse.json({
      employees,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    })
  } catch (error) {
    console.error('Get employees error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}

// POST /api/employees - Create new employee
export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createEmployeeSchema.parse(body)

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 400 }
      )
    }

    // Auto-generate employee ID and access key
    const employeeId = await generateEmployeeId()
    const accessKey = generateAccessKey()

    // Hash password
    const hashedPassword = await hash(validatedData.password, 10)

    // Create employee with optional settings
    const employee = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        designation: validatedData.designation,
        employeeId,
        accessKey,
        role: 'EMPLOYEE',
        joinedDate: validatedData.joinedDate ? new Date(validatedData.joinedDate) : null,
        settings: validatedData.checkInTime || validatedData.checkOutTime || validatedData.requiredWorkHours
          ? {
              create: {
                checkInTime: validatedData.checkInTime,
                checkOutTime: validatedData.checkOutTime,
                requiredWorkHours: validatedData.requiredWorkHours,
              },
            }
          : undefined,
      },
      include: {
        settings: true,
      },
    })

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        email: employee.email,
        name: employee.name,
        designation: employee.designation,
        employeeId: employee.employeeId,
        accessKey: employee.accessKey,
        isActive: employee.isActive,
        settings: employee.settings,
      },
    })
  } catch (error) {
    console.error('Create employee error:', error)
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    )
  }
}
