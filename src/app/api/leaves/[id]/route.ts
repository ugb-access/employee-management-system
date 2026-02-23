import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { approveLeaveSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'

// PUT /api/leaves/[id] - Approve/Reject leave (Admin only)
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
    const validatedData = approveLeaveSchema.parse({ ...body, leaveId: id })

    const leave = await prisma.leave.findUnique({
      where: { id: validatedData.leaveId },
    })

    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 })
    }

    if (leave.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Leave has already been processed' },
        { status: 400 }
      )
    }

    const updatedLeave = await prisma.leave.update({
      where: { id: validatedData.leaveId },
      data: {
        status: validatedData.status,
        approvedBy: session.user.id,
        approvedAt: new Date(),
        isPaid: validatedData.status === 'APPROVED' && leave.leaveType === 'PAID',
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
      leave: updatedLeave,
      message: `Leave ${validatedData.status.toLowerCase()} successfully`,
    })
  } catch (error) {
    console.error('Update leave error:', error)
    return NextResponse.json(
      { error: 'Failed to update leave' },
      { status: 500 }
    )
  }
}

// DELETE /api/leaves/[id] - Cancel leave request (Employee can cancel pending leaves)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const leave = await prisma.leave.findUnique({
      where: { id },
    })

    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 })
    }

    // Only the owner or admin can delete
    if (session.user.role !== 'ADMIN' && leave.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Can only delete pending leaves
    if (leave.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot cancel a processed leave request' },
        { status: 400 }
      )
    }

    await prisma.leave.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Leave request cancelled',
    })
  } catch (error) {
    console.error('Delete leave error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel leave' },
      { status: 500 }
    )
  }
}
