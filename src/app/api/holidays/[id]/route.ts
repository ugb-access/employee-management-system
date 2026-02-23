import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// DELETE /api/holidays/[id] - Delete holiday (Admin only)
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

    const holiday = await prisma.holiday.findUnique({
      where: { id },
    })

    if (!holiday) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 })
    }

    await prisma.holiday.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Holiday deleted successfully',
    })
  } catch (error) {
    console.error('Delete holiday error:', error)
    return NextResponse.json(
      { error: 'Failed to delete holiday' },
      { status: 500 }
    )
  }
}
