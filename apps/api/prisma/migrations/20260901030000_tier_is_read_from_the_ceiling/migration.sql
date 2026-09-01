-- HOW GOOD A PLAN IS, READ OFF WHAT IT ACTUALLY PAYS.
--
-- Basic, Standard and Premium are a reading of a variant's annual limit, and
-- the limit is already recorded. So the tier is DERIVED — there is no column
-- for it and nothing to keep in sync. A plan whose ceiling is raised becomes
-- Premium the moment it is saved rather than whenever somebody remembers to
-- refile it.
--
-- That leaves `insurance_types` with nothing to do. It held Base, Middle, High,
-- Standard and Medical: a category an employee picked by hand, free text, able
-- to disagree with the plan's own figures, and saying nothing a comparison
-- could act on. The thresholds in `config/plan-tiers.ts` say it properly.
--
-- WHAT THIS DELETES: the five category rows, and each plan's pointer at one of
-- them. No price, benefit, network or variant is touched — the ceiling those
-- categories were meant to approximate is on the variant and stays exactly
-- where it is.

-- ---------------------------------------------------------------------------
-- 1. Plans stop pointing at a category.
--
--    The constraint is dropped by every name it has ever had. PostgreSQL
--    truncates identifiers at 63 characters, and a DROP that silently matches
--    nothing would leave the foreign key in place to refuse step 2. That exact
--    fault bit the 20260820040000 migration.
-- ---------------------------------------------------------------------------
ALTER TABLE "plans" DROP CONSTRAINT IF EXISTS "plans_insuranceTypeId_fkey";
DROP INDEX IF EXISTS "plans_insuranceTypeId_isActive_idx";

ALTER TABLE "plans" DROP COLUMN IF EXISTS "insuranceTypeId";

-- ---------------------------------------------------------------------------
-- 2. The category table goes.
--
--    Nothing references it once the column above is gone, so this cannot
--    cascade into insurance data.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS "insurance_types";
