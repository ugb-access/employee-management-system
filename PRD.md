# Employee Management System - PRD (Product Requirements Document)

## 📋 Project Overview

**Project Name:** Employee Management System (EMS)
**Version:** 1.0
**Target Users:** Small to medium businesses (10-100 employees)
**Goal:** Streamline employee attendance tracking, leave management, and performance monitoring

---

## 🎯 Core Features

### 1. Authentication & Authorization

#### Implemented ✅
- [x] NextAuth.js v5 integration
- [x] Role-based access control (Admin vs Employee)
- [x] Secure password hashing with bcryptjs
- [x] Session management with JWT

#### Required 🔲
- [ ] Forgot password flow
- [ ] Password reset functionality
- [ ] Email verification for new accounts
- [ ] Remember me functionality
- [ ] Session timeout after inactivity

---

### 2. Admin Dashboard

#### Implemented ✅
- [x] Overview stats (total employees, present today, on leave, late arrivals)
- [x] Quick actions panel
- [x] Today's attendance summary

#### Required 🔲

##### 2.1 Employee Management
- [ ] **List View**
  - Paginated table of all employees
  - Search and filter options
  - Quick actions (edit, delete, view details)
  - Status indicators (active/inactive)

- [ ] **Create Employee**
  - Name, email, password
  - Employee ID (custom or auto-generated)
  - Designation/Role
  - Individual check-in/out time settings
  - Individual required work hours
  - Phone number (optional)
  - Join date

- [ ] **Edit Employee**
  - All create fields editable
  - Activate/Deactivate account
  - Reset password
  - View attendance history
  - View leave history

- [ ] **Delete Employee**
  - Soft delete (mark as inactive)
  - Hard delete with confirmation
  - Archive data retention policy

##### 2.2 Attendance Management
- [ ] **View All Attendance**
  - Date range filter
  - Employee filter
  - Status filter (present, absent, late, early checkout)
  - Export to CSV/Excel

- [ ] **Edit Attendance**
  - Admin can modify any attendance record
  - Change check-in/check-out times
  - Adjust fines manually
  - Mark as leave
  - Add notes/reason
  - Confirmation dialog for sensitive actions

- [ ] **Manual Attendance**
  - Mark attendance for employees who forgot
  - Bulk attendance marking
  - Import from CSV

##### 2.3 Leave Management
- [ ] **Leave Requests**
  - View all pending requests
  - Approve/Reject with reason
  - View request details
  - Filter by status, date, employee

- [ ] **Manual Leave**
  - Mark leave for any employee
  - Select leave type (paid, unpaid, sick, casual)
  - Add reason
  - Set leave duration (single/multiple days)
  - Apply to multiple employees (bulk)

##### 2.4 Settings & Configuration
- [ ] **Global Settings**
  - Default check-in time
  - Default check-out time
  - Required work hours (configurable, not fixed to 8)
  - Late fine base amount
  - Late fine per 30 minutes
  - Leave cost per day
  - Free paid leaves per month
  - Warning zone threshold
  - Danger zone threshold

- [ ] **Working Days**
  - Select working days (Mon-Fri, Mon-Sat, custom)
  - Set different schedules for different departments
  - Half-day configurations

- [ ] **Holidays**
  - Add public holidays
  - Holiday name and date
  - Recurring holidays (repeats every year)
  - Bulk import holidays
  - Archive past holidays

- [ ] **Off Days**
  - Mark individual off days for employees
  - Set as paid or unpaid
  - Add reason
  - Bulk operations

##### 2.5 Reports & Analytics
- [ ] **Overview Reports**
  - Monthly attendance summary
  - Yearly attendance trends
  - Employee-wise attendance
  - Department-wise stats

- [ ] **Fine Reports**
  - Total fines collected
  - Employee-wise fine summary
  - Monthly fine trends
  - Fine reasons breakdown

- [ ] **Leave Reports**
  - Leave balance for each employee
  - Leave usage patterns
  - Leave zone distribution
  - Monthly leave summary

- [ ] **Work Hours Reports**
  - Average hours worked
  - Incomplete days report
  - Overtime analysis
  - Productivity trends

- [ ] **Export Options**
  - PDF reports
  - Excel/CSV exports
  - Email reports
  - Scheduled reports

---

### 3. Employee Portal

#### Implemented ✅
- [x] Personal dashboard
- [x] Today's attendance status
- [x] Check-in/Check-out buttons
- [x] Quick stats display
- [x] Leave zone indicator

#### Required 🔲

##### 3.1 Attendance Management
- [ ] **Check-In**
  - One-click check-in
  - Late reason input (if late)
  - Show current time vs assigned time
  - Display fine warning if late

- [ ] **Check-Out**
  - One-click check-out
  - Early checkout reason (mandatory)
  - Show total hours worked
  - Show remaining hours if incomplete
  - Warning if < required hours

- [ ] **Self-Correction**
  - Edit check-in time within 15 minutes
  - Edit check-out time within 15 minutes
  - Reason required for changes
  - Warning about correction limits

- [ ] **Attendance History**
  - Calendar view of attendance
  - List view with details
  - Filter by date range
  - Status indicators (present, absent, late, etc.)

##### 3.2 Leave Management
- [ ] **Leave Request**
  - Date picker for leave date(s)
  - Leave type selection (paid, unpaid, sick, casual)
  - Reason input (mandatory, min characters)
  - Show leave balance
  - Warning if > 1 leave used
  - Submit request

- [ ] **Leave Balance**
  - Display remaining paid leaves
  - Display used leaves this month
  - Leave zone indicator
  - Leave cost calculator

- [ ] **Leave History**
  - List of all leave requests
  - Status badges (pending, approved, rejected)
  - Filter by status/month/year
  - View reason and admin response

- [ ] **Leave Calendar**
  - Visual calendar with leaves marked
  - Different colors for leave types
  - Holidays highlighted
  - Working days marked

##### 3.3 Profile (Read-Only)
- [ ] **Personal Information**
  - Name, employee ID, email
  - Designation, department
  - Phone number
  - Join date

- [ ] **Work Schedule**
  - Check-in time
  - Check-out time
  - Required work hours
  - Working days

- [ ] **Stats Summary**
  - Attendance percentage this month
  - Total fines this month
  - Leaves used this month
  - Current leave zone

---

## 🔄 Business Logic & Rules

### Fine Calculation
```
IF checkInTime > assignedCheckInTime:
  lateMinutes = checkInTime - assignedCheckInTime
  fineAmount = 250 (base)
  fineAmount += floor(lateMinutes / 30) * 250

Example:
- 5 min late = ₹0 (grace period if configured)
- 25 min late = ₹250
- 35 min late = ₹500
- 65 min late = ₹750
```

### Leave Policy
```
IF leavesThisMonth <= paidLeavesPerMonth:
  isPaid = TRUE
  cost = ₹0
ELSE:
  isPaid = FALSE
  cost = (leavesThisMonth - paidLeavesPerMonth) * 1000

Leave Zones:
- 0-2 leaves: Normal
- 3-4 leaves: Warning Zone
- 5+ leaves: Danger Zone
```

### Work Hours Compliance
```
requiredHours = globalSettings.requiredWorkHours OR userSettings.requiredWorkHours

IF totalHoursWorked < requiredHours:
  deficiencyHours = requiredHours - totalHoursWorked
  Mark as INCOMPLETE
  Show warning to employee
  Log in attendance record
```

### Auto-Leave Marking
```
CRON: Runs every hour at :00

IF currentTime >= 12:00 PM:
  FOR each activeEmployee:
    IF NOT checkedInToday:
      markAsAutoLeave(today)
      notifyEmployee()
      notifyAdmin()
```

### Time Correction Rules
```
Employee can edit within 15 minutes:
- Check-in correction allowed until checkInTime + 15 min
- Check-out correction allowed until checkOutTime + 15 min
- Reason required for all corrections
- Admin can edit anytime with confirmation
```

---

## 🎨 UI/UX Requirements

### Design System
- [ ] Use shadcn/ui components
- [ ] Custom green theme (provided colors)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Dark mode support

### User Experience
- [ ] Loading states for all async actions
- [ ] Error messages with helpful guidance
- [ ] Success notifications (toast/snackbar)
- [ ] Confirmation dialogs for destructive actions
- [ ] Keyboard shortcuts for common actions
- [ ] Quick search everywhere

### Accessibility
- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] High contrast mode
- [ ] Focus indicators

---

## 🔧 Technical Requirements

### Performance
- [ ] Page load < 2 seconds
- [ ] API response < 500ms
- [ ] Database query optimization
- [ ] Image optimization
- [ ] Lazy loading for large lists

### Security
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Rate limiting on APIs
- [ ] Input validation & sanitization
- [ ] Secure headers (CSP, HSTS, etc.)
- [ ] Password encryption

### Scalability
- [ ] Handle 100+ concurrent users
- [ ] Database indexing on all filters
- [ ] Pagination for large datasets
- [ ] Caching strategies
- [ ] CDN for static assets

### Monitoring
- [ ] Error tracking (Sentry)
- [ ] Analytics (user actions)
- [ ] Performance monitoring
- [ ] Uptime monitoring
- [ ] Backup strategy

---

## 📱 Integrations (Future)

### Phase 2
- [ ] Slack/Teams notifications
- [ ] Email notifications
- [ ] SMS alerts for important updates
- [ ] Calendar integration (Google, Outlook)
- [ ] Payroll system integration
- [ ] Biometric attendance integration

### Phase 3
- [ ] Mobile app (React Native)
- [ ] Geo-fencing for check-in
- [ ] Selfie verification
- [ ] Offline mode
- [ ] Multi-location support

---

## 🧪 Testing Requirements

### Unit Tests
- [ ] Calculation functions (fine, leave, hours)
- [ ] Validation schemas
- [ ] Utility functions

### Integration Tests
- [ ] API endpoints
- [ ] Database operations
- [ ] Authentication flow

### E2E Tests
- [ ] Critical user flows
- [ ] Admin workflows
- [ ] Employee workflows

### Manual Testing Checklist
See SETUP_GUIDE.md for detailed test scenarios

---

## 📊 Success Metrics

### User Engagement
- Daily active users
- Check-in compliance rate
- Feature usage statistics

### Business Impact
- Reduction in manual attendance work
- Leave management efficiency
- Fine collection accuracy
- Time saved on reports

### Technical
- Uptime > 99.9%
- Average response time < 500ms
- Error rate < 0.1%
- User satisfaction score

---

## 🗺️ Development Roadmap

### Sprint 1: Foundation ✅
- [x] Project setup
- [x] Database design
- [x] Authentication system
- [x] Basic dashboards

### Sprint 2: Core Features (Current)
- [ ] Employee management
- [ ] Attendance viewing/editing
- [ ] Leave request/approval
- [ ] Settings pages

### Sprint 3: Advanced Features
- [ ] Reports & analytics
- [ ] Charts & visualizations
- [ ] Export functionality
- [ ] Notifications

### Sprint 4: Polish & Launch
- [ ] Testing
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deployment

---

## 📝 Notes

### Assumptions
- All employees work in same timezone
- Single shift per day
- No overtime tracking (can be added later)
- No multi-location support (can be added later)

### Limitations (Phase 1)
- No mobile app (web only)
- No biometric integration
- No shift management
- No overtime calculation
- No payroll integration

### Future Enhancements
- Multi-tenant support
- API for third-party integrations
- Advanced reporting with custom filters
- Machine learning for pattern detection
- Employee performance predictions

---

## 📞 Contact & Support

**Product Owner:** [Your Name]
**Technical Lead:** [Your Name]
**Project Status:** Active Development
**Last Updated:** 2025-02-22

---

*This PRD is a living document and will be updated as the project evolves.*
