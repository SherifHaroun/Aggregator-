-- A customer signs in with an email and a password, and may name their company.
ALTER TABLE "customers" ADD COLUMN "companyName" TEXT;
ALTER TABLE "customers" ADD COLUMN "passwordHash" TEXT;
