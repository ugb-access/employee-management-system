import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Create the adapter
const adapter = new PrismaPg(pool)

// Create PrismaClient with the adapter
const prisma = new PrismaClient({
  adapter,
})

async function main() {
  console.log('Seeding database...')

  // Create global settings
  const globalSettings = await prisma.globalSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
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
  console.log('Global settings created:', globalSettings.id)

  // Create admin user
  const adminPassword = await hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      email: 'admin@company.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      designation: 'Administrator',
      employeeId: 'ADM001',
      isActive: true,
    },
  })
  console.log('Admin user created:', admin.email)

  // Create a test employee
  const employeePassword = await hash('employee123', 12)
  const employee = await prisma.user.upsert({
    where: { email: 'john@company.com' },
    update: {},
    create: {
      email: 'john@company.com',
      password: employeePassword,
      name: 'John Doe',
      role: 'EMPLOYEE',
      designation: 'Software Developer',
      employeeId: 'EMP001',
      isActive: true,
      settings: {
        create: {
          checkInTime: '09:00',
          checkOutTime: '17:00',
          requiredWorkHours: 8.0,
        },
      },
    },
  })
  console.log('Test employee created:', employee.email)

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
