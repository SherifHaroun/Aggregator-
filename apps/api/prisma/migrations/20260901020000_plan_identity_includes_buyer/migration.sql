-- A PLAN IS IDENTIFIED BY ITS COMPANY, ITS BUYER AND ITS CODE.
--
-- A company sells "Platinum" to individuals, to families and to SMEs. Those are
-- three separate products that merely share a name, and until now the key was
-- (company, code) alone — so the second one collided with the first and simply
-- could not be saved. The name was free to repeat and the code was not, which
-- left the code standing in the way of a real business case.
--
-- The customer type joins the key AND the derived code. The key alone would be
-- enough for codes this application generates, but an employee may type one of
-- their own, and "PLAT" entered for both Individual and Family is two products
-- rather than a mistake.

-- ---------------------------------------------------------------------------
-- 1. The old key goes FIRST.
--
--    Step 2 rewrites codes, and under the old key a rewrite could collide with
--    a row that is about to be rewritten itself. Dropping first lets the codes
--    move freely; the new key at the end is what proves the result is sound.
--
--    Dropped by every name it has ever had, not only the current one:
--    PostgreSQL truncates identifiers at 63 characters, and a DROP that
--    silently matches nothing leaves the old constraint in place, still
--    refusing the rows this migration exists to allow. That exact fault bit the
--    20260820040000 migration.
-- ---------------------------------------------------------------------------
ALTER TABLE "plans" DROP CONSTRAINT IF EXISTS "plans_companyId_code_key";
DROP INDEX IF EXISTS "plans_companyId_code_key";

-- ---------------------------------------------------------------------------
-- 2. Existing codes gain the buyer they were always implicitly for.
--
--    Skipped where the code already carries it, because this migration must be
--    safe against rows written after the code rule changed — appending a second
--    suffix would rename plans an employee is already using.
--
--    Skipped too where another plan of the same company AND buyer already holds
--    the target code. That plan is the one entitled to it; this row keeps the
--    code it has, which is still unique under the new key precisely because the
--    two differ.
-- ---------------------------------------------------------------------------
UPDATE "plans" AS p
SET "code" = left(p."code", 60 - (length(p."customerType"::text) + 1))
             || '-' || p."customerType"::text
WHERE p."code" NOT LIKE '%-' || p."customerType"::text
  AND NOT EXISTS (
    SELECT 1 FROM "plans" AS other
    WHERE other."companyId" = p."companyId"
      AND other."customerType" = p."customerType"
      AND other."id" <> p."id"
      AND other."code" = left(p."code", 60 - (length(p."customerType"::text) + 1))
                         || '-' || p."customerType"::text
  );

-- ---------------------------------------------------------------------------
-- 3. The new key. Three plans named Platinum are now three plans.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "plans_companyId_customerType_code_key"
  ON "plans"("companyId", "customerType", "code");
