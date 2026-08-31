-- The medical network becomes a property of the PRICED VARIANT, not the plan.
--
-- The same plan is routinely sold on two networks at two prices — "Gold" on the
-- full network and on the limited one differ by 6-22% in the legacy data. While
-- the network sat on the plan those were two plans with the network smuggled
-- into their names.
--
-- Existing plans DO name a network, so the value is carried down onto every one
-- of the plan's configurations before the column is dropped. Nothing is lost:
-- each variant ends up asserting exactly what its plan asserted.

-- 1. The variant gains the network and the room it buys.
ALTER TABLE "plan_configurations" ADD COLUMN "medicalNetworkId" TEXT;
ALTER TABLE "plan_configurations" ADD COLUMN "roomType" TEXT;

-- 2. Carry each plan's network down to its variants, BEFORE dropping it.
UPDATE "plan_configurations" AS c
SET "medicalNetworkId" = p."medicalNetworkId"
FROM "plans" AS p
WHERE p."id" = c."planId"
  AND p."medicalNetworkId" IS NOT NULL;

-- 3. The plan no longer names a network.
ALTER TABLE "plans" DROP CONSTRAINT IF EXISTS "plans_medicalNetworkId_fkey";
DROP INDEX IF EXISTS "plans_medicalNetworkId_idx";
ALTER TABLE "plans" DROP COLUMN "medicalNetworkId";

-- 4. The variant points at the network, and survives its deletion by
--    forgetting it rather than disappearing.
ALTER TABLE "plan_configurations"
  ADD CONSTRAINT "plan_configurations_medicalNetworkId_fkey"
  FOREIGN KEY ("medicalNetworkId") REFERENCES "company_medical_networks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "plan_configurations_medicalNetworkId_idx"
  ON "plan_configurations"("medicalNetworkId");

-- 5. A variant's identity now includes the network, the room and the ceiling.
--    Two variants of one plan may share an age band when they differ in any of
--    them — which is exactly what the old key forbade.
--    Every name this constraint has ever had is dropped, not just the current
--    one. A previous migration was bitten by Postgres truncating identifiers at
--    63 characters: the DROP named an index that no longer existed under that
--    name, the real one survived, and it went on refusing rows that were now
--    legitimate. The same mistake here would silently forbid a second network
--    for the same plan and age band — exactly what this migration exists to
--    allow — so all three are dropped and only one can remain.
DROP INDEX IF EXISTS "plan_configurations_identity_key";
DROP INDEX IF EXISTS "plan_configurations_planId_customerType_geographicalCoverag_key";
DROP INDEX IF EXISTS "plan_configurations_planId_customerType_geographicalCoverage_ag";

CREATE UNIQUE INDEX "plan_configurations_identity_key"
  ON "plan_configurations"(
    "planId", "customerType", "geographicalCoverage",
    "medicalNetworkId", "roomType", "annualLimit", "ageFrom", "ageTo"
  );

-- 6. What a network gives access to, recorded once per network.
--    Rows rather than ten columns, so an eleventh category is data. A document
--    may state a number, wording, or both — hence two nullable columns.
CREATE TABLE "network_providers" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "count" INTEGER,
    "detail" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "network_providers_networkId_category_key"
  ON "network_providers"("networkId", "category");

CREATE INDEX "network_providers_networkId_sortOrder_idx"
  ON "network_providers"("networkId", "sortOrder");

ALTER TABLE "network_providers"
  ADD CONSTRAINT "network_providers_networkId_fkey"
  FOREIGN KEY ("networkId") REFERENCES "company_medical_networks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
