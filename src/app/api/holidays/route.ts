import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { holidaySchema } from '@/lib/validations'
import { NextResponse } from 'next/server'

// GET /api/holidays - List holidays
export async function GET(req: Request) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year')

    const where: { year?: number } = {}

    if (year) {
      where.year = parseInt(year)
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: {
        date: 'asc',
      },
    })

    return NextResponse.json({ holidays })
  } catch (error) {
    console.error('Get holidays error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch holidays' },
      { status: 500 }
    )
  }
}

// POST /api/holidays - Create holiday (Admin only)
export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = holidaySchema.parse(body)

    const holidayDate = new Date(validatedData.date)
    holidayDate.setHours(0, 0, 0, 0)

    // Check if holiday already exists for this date
    const existingHoliday = await prisma.holiday.findFirst({
      where: {
        date: holidayDate,
        year: holidayDate.getFullYear(),
      },
    })

    if (existingHoliday) {
      return NextResponse.json(
        { error: 'Holiday already exists for this date' },
        { status: 400 }
      )
    }

    const holiday = await prisma.holiday.create({
      data: {
        name: validatedData.name,
        date: holidayDate,
        year: holidayDate.getFullYear(),
        isRecurring: validatedData.isRecurring,
      },
    })

    return NextResponse.json({
      success: true,
      holiday,
      message: 'Holiday added successfully',
    })
  } catch (error) {
    console.error('Create holiday error:', error)
    return NextResponse.json(
      { error: 'Failed to create holiday' },
      { status: 500 }
    )
  }
}
