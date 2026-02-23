# Employee Management System - Setup Guide

## ✅ Completed Setup

- Next.js 14 with App Router & TypeScript
- Prisma ORM with Neon PostgreSQL database
- NextAuth.js v5 authentication
- shadcn/ui components with custom theme
- Admin & Employee dashboards
- Check-in/Check-out functionality

## 🚀 Quick Start

### 1. Database Setup (Already Done)
You've successfully configured Neon database with the serverless adapter.

### 2. Generate Prisma Client & Seed Database
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 3. Start Development Server
```bash
npm run dev
```

Visit: http://localhost:3000

## 👤 Test Credentials

After seeding the database, use these credentials:

**Admin Account:**
- Email: `admin@company.com`
- Password: `admin123`

**Employee Account:**
- Email: `john@company.com`
- Password: `employee123`

## 📁 Project Structure

```
employee-management/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Database seed script
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── auth/          # NextAuth API routes
│   │   ├── dashboard/
│   │   │   ├── admin/         # Admin dashboard
│   │   │   └── employee/      # Employee dashboard
│   │   └── login/             # Login page
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   └── dashboard-layout.tsx
│   ├── lib/
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── prisma.ts          # Prisma client (Neon adapter)
│   │   ├── calculations.ts    # Fine & hours calculations
│   │   └── validations.ts     # Zod schemas
│   └── types/
│       └── index.ts           # TypeScript types
└── .env                       # Environment variables
```

## 🎯 Features Implemented

### ✅ Completed:
- [x] User authentication with role-based access
- [x] Admin dashboard with stats overview
- [x] Employee dashboard with quick actions
- [x] Check-in/Check-out API routes
- [x] Automatic late fine calculation (250 base + 250 per 30 mins)
- [x] Working hours tracking
- [x] Database models for all features

### 🚧 Still To Build:
- [ ] Employee management (Create/Edit/Delete employees)
- [ ] Leave management system (Request/Approve/Reject)
- [ ] Attendance viewing and editing
- [ ] Settings page (Working days, holidays, fines)
- [ ] Statistics and reports with Recharts
- [ ] Auto-leave marking cron job

## 🗄️ Database Schema

### Models:
- **User**: Employees and admin accounts
- **UserSettings**: Individual employee settings (check-in/out times, required hours)
- **GlobalSettings**: Company-wide settings (fines, working days, leave policies)
- **Attendance**: Daily attendance records with fines and hours
- **Leave**: Leave requests with approval workflow
- **Holiday**: Public holidays (can be recurring)
- **OffDay**: Individual employee off days

## ⚙️ Configuration

### Global Settings (Default Values):
- Check-in time: 09:00
- Check-out time: 17:00
- Required work hours: 8.0 hours
- Late fine base: ₹250
- Late fine per 30 mins: ₹250
- Leave cost: ₹1000 (after 1 free paid leave)
- Free paid leaves per month: 1
- Warning zone: 3 leaves
- Danger zone: 5 leaves
- Working days: Monday to Friday

## 🔐 Environment Variables

```env
DATABASE_URL="your-neon-connection-string"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="development"
```

## 📝 Business Logic

### Fine Calculation:
- Base fine: ₹250 for any lateness
- Additional: ₹250 for every 30 minutes
- Example: 35 minutes late = ₹250 + ₹250 = ₹500

### Leave Policy:
- 1 paid leave free per month
- Additional leaves cost ₹1000 each
- 3+ leaves = Warning zone
- 5+ leaves = Danger zone

### Work Hours:
- Default required: 8 hours per day
- Configurable per employee or globally
- Early checkout requires reason
- Incomplete days are logged

## 🛠️ Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:seed      # Seed database with test data
npm run db:studio    # Open Prisma Studio
```

## 📚 Next Steps

1. **Build Employee Management Pages**
   - List all employees
   - Create new employee account
   - Edit employee details
   - Set individual schedules

2. **Build Leave Management**
   - Leave request form
   - Admin approval interface
   - Leave calendar view

3. **Build Settings Pages**
   - Global settings form
   - Working days selector
   - Holiday manager

4. **Build Statistics**
   - Attendance reports
   - Leave analytics
   - Fine summaries
   - Charts with Recharts

5. **Add Cron Job**
   - Auto-mark leave after 12 PM
   - Daily attendance summary

## 🐛 Troubleshooting

### Database Connection Issues:
- Ensure `DATABASE_URL` is correct in `.env`
- Use direct connection (not pooler) for best results
- Check Neon console for database status

### Prisma Issues:
```bash
npm run db:generate  # Regenerate Prisma client
npm run db:push      # Push schema changes
```

### Build Issues:
```bash
rm -rf .next node_modules
npm install
npm run dev
```

## 📄 License

Proprietary - All rights reserved

---

Built with ❤️ using Next.js, Prisma, and Neon
