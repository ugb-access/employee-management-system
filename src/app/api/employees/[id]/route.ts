import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateEmployeeSchema } from '@/lib/validations'
import { generateAccessKey } from '@/lib/access-key'
import { hash } from 'bcryptjs'
import { NextResponse } from 'next/server'

// GET /api/employees/[id] - Get single employee
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const employee = await prisma.user.findUnique({
      where: { id },
      include: {
        settings: true,
        _count: {
          select: {
            attendance: true,
            leaves: true,
          },
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    return NextResponse.json({ employee })
  } catch (error) {
    console.error('Get employee error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    )
  }
}

// PUT /api/employees/[id] - Update employee
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
    const validatedData = updateEmployeeSchema.parse({ ...body, id })

    // Check if employee exists
    const existingEmployee = await prisma.user.findUnique({
      where: { id },
      include: { settings: true },
    })

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Check email uniqueness if changing email
    if (validatedData.email && validatedData.email !== existingEmployee.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: validatedData.email },
      })
      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: {
      email?: string
      name?: string
      designation?: string
      password?: string
      isActive?: boolean
      accessKey?: string
      joinedDate?: Date | null
    } = {}

    if (validatedData.email) updateData.email = validatedData.email
    if (validatedData.name) updateData.name = validatedData.name
    if (validatedData.designation) updateData.designation = validatedData.designation
    if (validatedData.password) {
      updateData.password = await hash(validatedData.password, 10)
    }
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive
    if (validatedData.joinedDate !== undefined) {
      updateData.joinedDate = validatedData.joinedDate ? new Date(validatedData.joinedDate) : null
    }

    // Regenerate access key if requested
    if (validatedData.regenerateAccessKey) {
      updateData.accessKey = generateAccessKey()
    }

    // Update employee
    const employee = await prisma.user.update({
      where: { id },
      data: updateData,
    })

    // Update or create settings if provided
    if (validatedData.checkInTime || validatedData.checkOutTime || validatedData.requiredWorkHours) {
      if (existingEmployee.settings) {
        await prisma.userSettings.update({
          where: { userId: id },
          data: {
            checkInTime: validatedData.checkInTime,
            checkOutTime: validatedData.checkOutTime,
            requiredWorkHours: validatedData.requiredWorkHours,
          },
        })
      } else {
        await prisma.userSettings.create({
          data: {
            userId: id,
            checkInTime: validatedData.checkInTime,
            checkOutTime: validatedData.checkOutTime,
            requiredWorkHours: validatedData.requiredWorkHours,
          },
        })
      }
    }

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
      },
    })
  } catch (error) {
    console.error('Update employee error:', error)
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    )
  }
}

// DELETE /api/employees/[id] - Delete employee (soft delete by setting isActive to false)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if employee exists
    const employee = await prisma.user.findUnique({
      where: { id },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Soft delete by deactivating
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true, message: 'Employee deactivated' })
  } catch (error) {
    console.error('Delete employee error:', error)
    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    )
  }
}
