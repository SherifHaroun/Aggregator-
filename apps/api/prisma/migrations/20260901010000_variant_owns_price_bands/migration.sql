-- A VARIANT OWNS ITS BENEFITS ONCE, AND ITS PRICES BAND BY BAND.
--
-- Until now a "configuration" was one plan, one customer type, one coverage
-- scope, one network, one ceiling AND one age band — so a plan priced across
-- ten bands held ten rows carrying ten identical copies of its benefits. The
-- legacy data showed that duplication was never necessary: across 32 products,
-- all 69 age rows of each carried an identical benefit set and only the premium
-- moved.
--
-- So the age band leaves the row and becomes a child of it, and who the plan is
-- sold to moves up onto the plan, where a company's Individual, Family and SME
-- books are separate products that merely share a name.
--
-- The collapse is lossy BY CONSTRUCTION: rows that differed only by age band
-- are merged, and only the earliest one's benefits survive. That is the point —
-- the others were copies. Their values go with them.

-- ---------------------------------------------------------------------------
-- 1. Who the plan is for.
-- ---------------------------------------------------------------------------
ALTER TABLE "plans" ADD COLUMN "customerType" "CustomerType";

-- Taken from the plan's own configurations, earliest first, so a plan keeps the
-- buyer it was actually entered for.
UPDATE "plans" AS p
SET "customerType" = c."customerType"
FROM (
  SELECT DISTINCT ON ("planId") "planId", "customerType"
  FROM "plan_configurations"
  ORDER BY "planId", "createdAt" ASC, "id" ASC
) AS c
WHERE c."planId" = p."id";

-- A plan with no configurations at all has nothing to inherit; Individual is
-- the only buyer the entry form has ever created.
UPDATE "plans" SET "customerType" = 'INDIVIDUAL' WHERE "customerType" IS NULL;

ALTER TABLE "plans" ALTER COLUMN "customerType" SET NOT NULL;

CREATE INDEX "plans_companyId_customerType_isActive_idx"
  ON "plans"("companyId", "customerType", "isActive");

-- ---------------------------------------------------------------------------
-- 2. What a variant costs, band by band.
-- ---------------------------------------------------------------------------
CREATE TABLE "plan_price_bands" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "ageFrom" INTEGER NOT NULL,
    "ageTo" INTEGER NOT NULL,
    "annualPrice" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_price_bands_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 3. Decide which configuration SURVIVES as the variant.
--
--    One per (plan, coverage, network, room, ceiling) — the earliest, because
--    it is the one whose benefits were entered rather than copied.
-- ---------------------------------------------------------------------------
CREATE TEMPORARY TABLE "variant_survivor" AS
SELECT DISTINCT ON (
  "planId", "geographicalCoverage", "medicalNetworkId", "roomType", "annualLimit"
)
  "id" AS survivor_id,
  "planId", "geographicalCoverage", "medicalNetworkId", "roomType", "annualLimit"
FROM "plan_configurations"
ORDER BY
  "planId", "geographicalCoverage", "medicalNetworkId", "roomType", "annualLimit",
  "createdAt" ASC, "id" ASC;

-- Every configuration, mapped to the variant it belongs to. NULLs must compare
-- equal here, which `=` does not do — hence IS NOT DISTINCT FROM.
CREATE TEMPORARY TABLE "variant_map" AS
SELECT c."id" AS old_id, s.survivor_id, c."ageFrom", c."ageTo", c."annualPrice"
FROM "plan_configurations" AS c
JOIN "variant_survivor" AS s
  ON  s."planId" = c."planId"
  AND s."geographicalCoverage" = c."geographicalCoverage"
  AND s."medicalNetworkId" IS NOT DISTINCT FROM c."medicalNetworkId"
  AND s."roomType"         IS NOT DISTINCT FROM c."roomType"
  AND s."annualLimit"      IS NOT DISTINCT FROM c."annualLimit";

-- 4. Every configuration becomes a price band of its variant. A band that
--    priced nothing is still carried: the row said which ages it applied to.
--    Duplicate bands within one variant are impossible — the old identity key
--    included the age band.
INSERT INTO "plan_price_bands" ("id", "variantId", "ageFrom", "ageTo", "annualPrice", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || old_id),
  survivor_id, "ageFrom", "ageTo", "annualPrice", CURRENT_TIMESTAMP
FROM "variant_map";

-- 5. The copies go. Their PlanOption rows and values cascade with them, which
--    is correct: they were duplicates of the survivor's.
DELETE FROM "plan_configurations"
WHERE "id" IN (SELECT old_id FROM "variant_map" WHERE old_id <> survivor_id);

-- ---------------------------------------------------------------------------
-- 6. The variant row sheds what has moved.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "plan_configurations_identity_key";
DROP INDEX IF EXISTS "plan_configurations_customerType_geographicalCoverage_isActive_idx";
DROP INDEX IF EXISTS "plan_configurations_ageFrom_ageTo_idx";

ALTER TABLE "plan_configurations" DROP COLUMN "customerType";
ALTER TABLE "plan_configurations" DROP COLUMN "ageFrom";
ALTER TABLE "plan_configurations" DROP COLUMN "ageTo";
ALTER TABLE "plan_configurations" DROP COLUMN "annualPrice";

CREATE UNIQUE INDEX "plan_configurations_identity_key"
  ON "plan_configurations"(
    "planId", "geographicalCoverage", "medicalNetworkId", "roomType", "annualLimit"
  );

CREATE INDEX "plan_configurations_geographicalCoverage_isActive_idx"
  ON "plan_configurations"("geographicalCoverage", "isActive");

-- ---------------------------------------------------------------------------
-- 7. Wire the price bands up.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "plan_price_bands_variantId_ageFrom_ageTo_key"
  ON "plan_price_bands"("variantId", "ageFrom", "ageTo");

CREATE INDEX "plan_price_bands_ageFrom_ageTo_idx" ON "plan_price_bands"("ageFrom", "ageTo");
CREATE INDEX "plan_price_bands_variantId_idx" ON "plan_price_bands"("variantId");

ALTER TABLE "plan_price_bands"
  ADD CONSTRAINT "plan_price_bands_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "plan_configurations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
