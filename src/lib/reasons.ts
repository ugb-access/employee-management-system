/**
 * Predefined reasons employees pick from when checking in late or checking
 * out early. Choosing "Other" requires a detailed written explanation.
 *
 * The stored reason is the chosen option, optionally followed by details
 * ("Traffic / road blockage — accident on canal road"), or "Other: <text>".
 */

export const OTHER_REASON = 'Other'
export const MIN_OTHER_REASON_LENGTH = 30

export const LATE_CHECKIN_REASONS = [
  'Communicated to manager in advance',
  'Traffic / road blockage',
  'Public transport delay',
  'Vehicle breakdown',
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
  OTHER_REASON,
] as const

const DETAILS_SEPARATOR = ' — '

export function buildReason(choice: string, details: string): string {
  const text = details.trim()
  if (choice === OTHER_REASON) return `${OTHER_REASON}: ${text}`
  return text ? `${choice}${DETAILS_SEPARATOR}${text}` : choice
}

/**
 * Returns an error message, or null when the reason is acceptable.
 */
export function validateReason(
  reason: string | undefined,
  options: readonly string[]
): string | null {
  const value = reason?.trim()
  if (!value) return 'Please select a reason'

  if (value.startsWith(`${OTHER_REASON}:`)) {
    const details = value.slice(OTHER_REASON.length + 1).trim()
    if (details.length < MIN_OTHER_REASON_LENGTH) {
      return `Please explain in at least ${MIN_OTHER_REASON_LENGTH} characters`
    }
    return null
  }

  const isListed = options.some(
    (option) =>
      option !== OTHER_REASON &&
      (value === option || value.startsWith(`${option}${DETAILS_SEPARATOR}`))
  )
  return isListed ? null : 'Please select a reason from the list'
}
