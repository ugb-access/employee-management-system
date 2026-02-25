import crypto from 'crypto'
import { prisma } from './prisma'

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function generateAccessKey(length = 12): string {
  const bytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += ALPHANUMERIC[bytes[i] % ALPHANUMERIC.length]
  }
  return result
}

export async function generateEmployeeId(): Promise<string> {
  // Find the highest existing employee ID with EMP prefix
  const lastEmployee = await prisma.user.findFirst({
    where: {
      employeeId: {
        startsWith: 'EMP',
      },
    },
    orderBy: {
      employeeId: 'desc',
    },
    select: {
      employeeId: true,
    },
  })

  if (!lastEmployee?.employeeId) {
    return 'EMP001'
  }

  const numPart = parseInt(lastEmployee.employeeId.replace('EMP', ''), 10)
  const next = numPart + 1
  return `EMP${next.toString().padStart(3, '0')}`
}
