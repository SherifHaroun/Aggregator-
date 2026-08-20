-- A plan configuration now declares the age band it applies to.
--
-- Both bounds are required, because a configuration that applies to nobody in
-- particular cannot take part in a comparison. Existing rows predate the rule,
-- so they are opened to every insurable age rather than guessed at: they keep
-- matching exactly who they matched before, and an admin can narrow them.

ALTER TABLE "plan_configurations" ADD COLUMN "ageFrom" INTEGER;
ALTER TABLE "plan_configurations" ADD COLUMN "ageTo" INTEGER;

-- Backfill, not seed data: these are existing records being given the widest
-- band so nothing that used to match stops matching.
UPDATE "plan_configurations" SET "ageFrom" = 0 WHERE "ageFrom" IS NULL;
UPDATE "plan_configurations" SET "ageTo" = 120 WHERE "ageTo" IS NULL;

ALTER TABLE "plan_configurations" ALTER COLUMN "ageFrom" SET NOT NULL;
ALTER TABLE "plan_configurations" ALTER COLUMN "ageTo" SET NOT NULL;

-- The database refuses a nonsensical band even if a future client forgets to.
ALTER TABLE "plan_configurations"
  ADD CONSTRAINT "plan_configurations_age_band_check"
  CHECK ("ageFrom" >= 0 AND "ageTo" >= "ageFrom");

-- The age band joins the configuration's identity, so one plan can price
-- 18-40 and 41-60 separately for the same customer type and coverage area.
DROP INDEX IF EXISTS "plan_configurations_planId_customerType_geographicalCoverage_key";

CREATE UNIQUE INDEX "plan_configurations_planId_customerType_geographicalCoverage_ageFrom_ageTo_key"
  ON "plan_configurations" ("planId", "customerType", "geographicalCoverage", "ageFrom", "ageTo");

CREATE INDEX "plan_configurations_ageFrom_ageTo_idx"
  ON "plan_configurations" ("ageFrom", "ageTo");
