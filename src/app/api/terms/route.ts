import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeHtml } from '@/lib/sanitize'
import { generateDefaultTermsHtml, type TermsSettings } from '@/lib/terms'
import { NextResponse } from 'next/server'

function toTermsSettings(settings: {
  checkInTime: string
  checkOutTime: string
  requiredWorkHours: number
  gracePeriodMinutes: number
  lateFineBase: number
  lateFinePer30Min: number
  leaveCost: number
  paidLeavesPerMonth: number
  warningLeaveCount: number
  dangerLeaveCount: number
  workingDays: string
  flexibleHoursEnabled: boolean
}): TermsSettings {
  return {
    checkInTime: settings.checkInTime,
    checkOutTime: settings.checkOutTime,
    requiredWorkHours: settings.requiredWorkHours,
    gracePeriodMinutes: settings.gracePeriodMinutes,
    lateFineBase: settings.lateFineBase,
    lateFinePer30Min: settings.lateFinePer30Min,
    leaveCost: settings.leaveCost,
    paidLeavesPerMonth: settings.paidLeavesPerMonth,
    warningLeaveCount: settings.warningLeaveCount,
    dangerLeaveCount: settings.dangerLeaveCount,
    workingDays: settings.workingDays,
    flexibleHoursEnabled: settings.flexibleHoursEnabled,
  }
}

// GET /api/terms - Get the Terms & Policies content (any authenticated user)
export async function GET() {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let settings = await prisma.globalSettings.findFirst()

    // No settings row yet -> create one with defaults so the generated
    // document is never empty (mirrors the /api/settings behavior).
    if (!settings) {
      settings = await prisma.globalSettings.create({ data: {} })
    }

    if (settings.termsContent && settings.termsContent.trim().length > 0) {
      return NextResponse.json({
        content: sanitizeHtml(settings.termsContent),
        isDefault: false,
      })
    }

    // Fall back to a default generated from the live settings
    return NextResponse.json({
      content: generateDefaultTermsHtml(toTermsSettings(settings)),
      isDefault: true,
    })
  } catch (error) {
    console.error('Get terms error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch terms' },
      { status: 500 }
    )
  }
}

// PUT /api/terms - Save the Terms & Policies content (Admin only)
export async function PUT(req: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    if (typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Sanitize before storing so we never persist unsafe markup
    const safeContent = sanitizeHtml(body.content)

    let settings = await prisma.globalSettings.findFirst()

    if (!settings) {
      settings = await prisma.globalSettings.create({
        data: { termsContent: safeContent },
      })
    } else {
      settings = await prisma.globalSettings.update({
        where: { id: settings.id },
        data: { termsContent: safeContent },
      })
    }

    return NextResponse.json({
      success: true,
      content: safeContent,
      message: 'Terms & Policies updated successfully',
    })
  } catch (error) {
    console.error('Update terms error:', error)
    return NextResponse.json(
      { error: 'Failed to update terms' },
      { status: 500 }
    )
  }
}
