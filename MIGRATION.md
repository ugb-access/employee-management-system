# Database Migrations

This project uses `prisma db push` to sync the schema to the database.

After pulling changes that modify `prisma/schema.prisma`, run (with `DATABASE_URL` set):

```bash
npx prisma db push
npx prisma generate
```

## Terms & Policies (this change)

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
