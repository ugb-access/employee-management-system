// CSV Export utility functions

const PKT_TIMEZONE = 'Asia/Karachi'

export interface ExportColumn<T> {
  header: string
  accessor: keyof T | ((row: T) => string | number | null)
}

export function exportToCSV<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
) {
  // Generate CSV headers
  const headers = columns.map((col) => col.header).join(',')

  // Generate CSV rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        let value: string | number | null
        if (typeof col.accessor === 'function') {
          value = col.accessor(row)
        } else {
          value = row[col.accessor] as string | number | null
        }

        // Handle null/undefined
        if (value === null || value === undefined) {
          return ''
        }

        // Convert to string and escape quotes
        const stringValue = String(value)
        // If the value contains commas, quotes, or newlines, wrap in quotes
        if (
          stringValue.includes(',') ||
          stringValue.includes('"') ||
          stringValue.includes('\n')
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      })
      .join(',')
  })

  // Combine headers and rows
  const csv = [headers, ...rows].join('\n')

  // Create blob and download
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

export function formatDateForExport(date: string | Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatTimeForExport(date: string | Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PKT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}
