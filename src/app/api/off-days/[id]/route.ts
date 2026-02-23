import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// DELETE /api/off-days/[id] - Delete off day (Admin only)
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

    const offDay = await prisma.offDay.findUnique({
      where: { id },
    })

    if (!offDay) {
      return NextResponse.json({ error: 'Off day not found' }, { status: 404 })
    }

    await prisma.offDay.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Off day deleted successfully',
    })
  } catch (error) {
    console.error('Delete off-day error:', error)
    return NextResponse.json(
      { error: 'Failed to delete off-day' },
      { status: 500 }
    )
  }
}
