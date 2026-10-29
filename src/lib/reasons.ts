/**
 * Predefined reasons picked from a list for late check-in, early checkout and
 * fine waivers. Choosing "Other" requires a detailed written explanation.
 *
 * The stored reason is the chosen option, optionally followed by details
 * ("Traffic / road blockage — accident on canal road"), or "Other: <text>".
 */

export const OTHER_REASON = 'Other'
export const MIN_OTHER_REASON_LENGTH = 30
export const MIN_OTHER_REASON_WORDS = 5

export const LATE_CHECKIN_REASONS = [
  'Communicated to manager in advance',
  'Traffic / road blockage',
  'Public transport delay',
  'Vehicle breakdown',
  'Load shedding / power outage',
  'Bad weather (rain / fog)',
  'Medical / health issue',
  'Family emergency',
  'Official work outside office',
  OTHER_REASON,
] as const

export const EARLY_CHECKOUT_REASONS = [
  'Communicated to manager / approved',
  'Medical / health issue',
  'Family emergency',
  'Official work outside office',
  'Power / internet outage at office',
  OTHER_REASON,
] as const

export const FINE_WAIVER_REASONS = [
  'Approved by management',
  'Delay communicated in advance',
  'Verified emergency',
  'Official duty outside office',
  'Attendance system / app issue',
  'Recorded incorrectly',
  OTHER_REASON,
] as const

const DETAILS_SEPARATOR = ' — '

export function buildReason(choice: string, details: string): string {
  const text = details.trim()
  if (choice === OTHER_REASON) return `${OTHER_REASON}: ${text}`
  return text ? `${choice}${DETAILS_SEPARATOR}${text}` : choice
}

/**
 * Splits a stored reason back into its option and details. Reasons that don't
 * match the list (e.g. old free-text entries) come back empty so they have to
 * be re-selected.
 */
export function parseReason(
  reason: string | null | undefined,
  options: readonly string[]
): { choice: string; details: string } {
  const value = reason?.trim() ?? ''
  if (value.startsWith(`${OTHER_REASON}:`)) {
    return { choice: OTHER_REASON, details: value.slice(OTHER_REASON.length + 1).trim() }
  }
  for (const option of options) {
    if (option === OTHER_REASON) continue
    if (value === option) return { choice: option, details: '' }
    if (value.startsWith(`${option}${DETAILS_SEPARATOR}`)) {
      return { choice: option, details: value.slice(option.length + DETAILS_SEPARATOR.length) }
    }
  }
  return { choice: '', details: '' }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Returns an error message, or null when the reason is acceptable.
 */
export function validateReason(
  reason: string | null | undefined,
  options: readonly string[]
): string | null {
  const value = reason?.trim()
  if (!value) return 'Please select a reason'

  const { choice, details } = parseReason(value, options)
  if (!choice) return 'Please select a reason from the list'

  if (choice === OTHER_REASON) {
    if (details.length < MIN_OTHER_REASON_LENGTH || countWords(details) < MIN_OTHER_REASON_WORDS) {
      return `Please explain in at least ${MIN_OTHER_REASON_WORDS} words (${MIN_OTHER_REASON_LENGTH}+ characters)`
    }
  }
  return null
}
