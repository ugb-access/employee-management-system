import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { globalSettingsSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'

// GET /api/settings - Get global settings
export async function GET() {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let settings = await prisma.globalSettings.findFirst()

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.globalSettings.create({
        data: {
          checkInTime: '09:00',
          checkOutTime: '17:00',
          requiredWorkHours: 8.0,
          lateFineBase: 250,
          lateFinePer30Min: 250,
          leaveCost: 1000,
          paidLeavesPerMonth: 1,
          warningLeaveCount: 3,
          dangerLeaveCount: 5,
          workingDays: '1,2,3,4,5',
        },
      })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Get settings error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// PUT /api/settings - Update global settings (Admin only)
export async function PUT(req: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = globalSettingsSchema.parse(body)

    let settings = await prisma.globalSettings.findFirst()

    if (!settings) {
      // Create new settings
      settings = await prisma.globalSettings.create({
        data: {
          checkInTime: validatedData.checkInTime,
          checkOutTime: validatedData.checkOutTime,
          requiredWorkHours: validatedData.requiredWorkHours,
          lateFineBase: validatedData.lateFineBase,
          lateFinePer30Min: validatedData.lateFinePer30Min,
          leaveCost: validatedData.leaveCost,
          paidLeavesPerMonth: validatedData.paidLeavesPerMonth,
          warningLeaveCount: validatedData.warningLeaveCount,
          dangerLeaveCount: validatedData.dangerLeaveCount,
          workingDays: validatedData.workingDays.join(','),
        },
      })
    } else {
      // Update existing settings
      settings = await prisma.globalSettings.update({
        where: { id: settings.id },
        data: {
          checkInTime: validatedData.checkInTime,
          checkOutTime: validatedData.checkOutTime,
          requiredWorkHours: validatedData.requiredWorkHours,
          lateFineBase: validatedData.lateFineBase,
          lateFinePer30Min: validatedData.lateFinePer30Min,
          leaveCost: validatedData.leaveCost,
          paidLeavesPerMonth: validatedData.paidLeavesPerMonth,
          warningLeaveCount: validatedData.warningLeaveCount,
          dangerLeaveCount: validatedData.dangerLeaveCount,
          workingDays: validatedData.workingDays.join(','),
        },
      })
    }

    return NextResponse.json({
      success: true,
      settings,
      message: 'Settings updated successfully',
    })
  } catch (error) {
    console.error('Update settings error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
