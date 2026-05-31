/**
 * Generates the default Terms & Policies document (as HTML) from the current
 * system settings. This is used to pre-fill the editor for admins and as the
 * fallback shown to employees before an admin has saved a custom version.
 *
 * The output mirrors how the system actually behaves (fines, grace period,
 * leave costs, working days, holidays/off-days, reason requirements), so the
 * document stays truthful to the live configuration when regenerated.
 */

export interface TermsSettings {
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
  workingDays: string | number[]
  flexibleHoursEnabled: boolean
}

const ISO_DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
}

function parseWorkingDays(workingDays: string | number[]): number[] {
  if (Array.isArray(workingDays)) return workingDays
  return workingDays
    .split(',')
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => !Number.isNaN(d))
}

/** Convert "09:30" (24h) into a friendly "9:30 AM". */
function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr ?? '0', 10)
  if (Number.isNaN(h)) return time
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`
}

/** Join a list of names into "A, B and C". */
function joinWithAnd(items: string[]): string {
  if (items.length === 0) return 'None'
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function generateDefaultTermsHtml(settings: TermsSettings): string {
  const working = parseWorkingDays(settings.workingDays).sort((a, b) => a - b)
  const workingNames = working.map((d) => ISO_DAY_NAMES[d]).filter(Boolean)
  const offDayNames = [1, 2, 3, 4, 5, 6, 7]
    .filter((d) => !working.includes(d))
    .map((d) => ISO_DAY_NAMES[d])

  const checkIn = formatTime12h(settings.checkInTime)
  const checkOut = formatTime12h(settings.checkOutTime)

  return `
<h1>Workplace Attendance & Leave Policy</h1>
<p>This page summarises the working hours, attendance rules, fines and leave policies that apply to all employees. Please read it carefully. These terms reflect how the system currently operates.</p>

<h2>1. Working Hours &amp; Days</h2>
<ul>
  <li><strong>Office timings:</strong> ${checkIn} to ${checkOut}.</li>
  <li><strong>Required working hours:</strong> ${settings.requiredWorkHours} hours per day.</li>
  <li><strong>Working days:</strong> ${joinWithAnd(workingNames)}.</li>
  <li><strong>Weekly off:</strong> ${joinWithAnd(offDayNames)}.</li>
</ul>

<h2>2. Grace Period</h2>
<p>A grace period of <strong>${settings.gracePeriodMinutes} minutes</strong> is allowed after the check-in time. Arriving within the grace period does <strong>not</strong> incur any late fine.</p>

<h2>3. Late Arrival Fines</h2>
<p>If you check in after the grace period, the following fine applies:</p>
<ul>
  <li><strong>Base late fine:</strong> Rs. ${settings.lateFineBase} once you are late beyond the grace period.</li>
  <li><strong>Additional fine:</strong> Rs. ${settings.lateFinePer30Min} for every additional 30 minutes of lateness after the grace period.</li>
</ul>
${
  settings.flexibleHoursEnabled
    ? `<p><strong>Flexible hours:</strong> If you complete your full required working hours (${settings.requiredWorkHours} hours) for the day, the late fine is waived.</p>`
    : ''
}

<h2>4. Leaves</h2>
<ul>
  <li><strong>Free paid leaves:</strong> ${settings.paidLeavesPerMonth} paid leave(s) per month.</li>
  <li><strong>Unpaid leave cost:</strong> Rs. ${settings.leaveCost} is deducted for each leave taken beyond your free monthly allowance.</li>
  <li><strong>Warning threshold:</strong> Taking ${settings.warningLeaveCount} or more leaves in a month places you in the <em>warning</em> zone.</li>
  <li><strong>Danger threshold:</strong> Taking ${settings.dangerLeaveCount} or more leaves in a month places you in the <em>danger</em> zone.</li>
</ul>

<h2>5. Public Holidays &amp; Off Days</h2>
<p>Any day marked as a <strong>public holiday</strong>, or a day specifically marked as an <strong>off day</strong> for you, is not a working day. You will <strong>not</strong> be marked absent or charged any fine for these days.</p>

<h2>6. Valid Reason Required</h2>
<p>A clear, valid reason is required in the following cases:</p>
<ul>
  <li>When you <strong>check in late</strong> (after the scheduled check-in time).</li>
  <li>When you <strong>check out early</strong> (before the scheduled check-out time).</li>
  <li>When you <strong>apply for a leave</strong>.</li>
</ul>
<p>Requests submitted without a proper reason may be rejected.</p>
`.trim()
}
