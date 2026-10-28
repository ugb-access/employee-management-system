# Database Migrations

This project uses `prisma db push` to sync the schema to the database.

After pulling changes that modify `prisma/schema.prisma`, run (with `DATABASE_URL` set):

```bash
npx prisma db push
npx prisma generate
```

## Missing Checkout Fine (this change)

Adds an optional fine for when an employee checks in but never checks out for
the day. (For a flat late fine, set "Fine per 30 mins late" to 0 in Settings.)

```sql
ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "missingCheckoutFineEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "missingCheckoutFine" INTEGER NOT NULL DEFAULT 250;
ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "missingCheckoutFineFrom" DATE;
```

The missing checkout fine is off by default; enable it and set the amount
under Admin → Settings. When it is switched on, it applies from the next day
onward (`missingCheckoutFineFrom`), so past days are never fined retroactively.
It is calculated when attendance is viewed (not stored on the record), so
turning the setting off removes it, and an admin adding a checkout time clears
it for that day.

### One-time reset of existing fines

The new fine rules start on 29 Oct 2026. To clear every fine recorded under the
old rules (all attendance up to and including 28 Oct 2026), run once:

```sql
UPDATE "Attendance" SET "fineAmount" = 0 WHERE "date" <= DATE '2026-10-28' AND "fineAmount" > 0;
```

Late minutes are kept on the records, so lateness history is still visible;
only the fine amounts are removed.

## Terms & Policies (previous change)

Adds a column to store the editable Terms & Policies document:

```sql
ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "termsContent" TEXT;
```

This column is nullable. When empty, the Terms & Policies page shows a document
generated automatically from the current settings until an admin saves a custom
version.

## Flexible Hours (previous change)

If not already applied:

```sql
ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "flexibleHoursEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "flexibleHoursEnabled" BOOLEAN;
```
