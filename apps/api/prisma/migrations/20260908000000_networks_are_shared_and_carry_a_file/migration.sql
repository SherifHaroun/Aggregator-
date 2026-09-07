-- A MEDICAL NETWORK IS SHARED, NAMED BY THE PLAN, AND CARRIES ITS PROVIDER LIST.
--
-- GlobeMed is one network however many insurers sell on it. Held per company
-- it was the same estate entered five times, with five copies of the provider
-- list to keep current — and the list changes every few months. So a network
-- becomes a GLOBAL record, like a benefit: defined once, offered to every plan.
--
-- The plan names it, not the variant. Every priced row of a plan gives access
-- to the same estate, and the customer is told the network's name and handed
-- its list — never which tier of it they bought, because that is negotiated.
--
-- The provider list itself is a FILE the insurer sends, stored as sent and
-- replaced whole when a new one arrives. What a network "gives access to" is
-- therefore no longer typed in by hand, and the provider-count rows go.
--
-- WHAT THIS DOES TO EXISTING DATA — nothing is thrown away:
--   * every distinct network name across every company becomes one shared row;
--   * every plan takes the network most of its variants named;
--   * a variant that named a DIFFERENT network is moved to a plan of its own,
--     "<plan> (<network>)", because under the new rule that is what it is;
--   * the per-company rows and their provider counts are dropped last.

-- ---------------------------------------------------------------------------
-- 1. The shared list.
-- ---------------------------------------------------------------------------
CREATE TABLE "medical_networks" (
  "id"                    TEXT NOT NULL,
  "name"                  TEXT NOT NULL,
  "description"           TEXT,
  "sortOrder"             INTEGER NOT NULL DEFAULT 0,
  "isActive"              BOOLEAN NOT NULL DEFAULT true,
  "providerListUrl"       TEXT,
  "providerListFileName"  TEXT,
  "providerListUpdatedAt" TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "medical_networks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "medical_networks_name_key" ON "medical_networks"("name");
CREATE INDEX "medical_networks_isActive_sortOrder_idx" ON "medical_networks"("isActive", "sortOrder");

-- ---------------------------------------------------------------------------
-- 2. One shared row per distinct name, ignoring case and surrounding space.
--
--    The earliest-created company row lends its id, so anything that recorded
--    that id keeps pointing at a real network. A name is kept active if ANY
--    company still sold it.
-- ---------------------------------------------------------------------------
INSERT INTO "medical_networks"
  ("id", "name", "description", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT
  (array_agg(n."id"                ORDER BY n."createdAt", n."id"))[1],
  (array_agg(btrim(n."name")       ORDER BY n."createdAt", n."id"))[1],
  (array_agg(n."description"       ORDER BY n."createdAt", n."id"))[1],
  min(n."sortOrder"),
  bool_or(n."isActive"),
  min(n."createdAt"),
  max(n."updatedAt")
FROM "company_medical_networks" AS n
GROUP BY lower(btrim(n."name"));

-- Positions renumbered from the top, so the list reads 0, 1, 2 rather than
-- whatever ranks the companies happened to give.
WITH ranked AS (
  SELECT "id", row_number() OVER (ORDER BY "sortOrder", lower("name")) - 1 AS position
  FROM "medical_networks"
)
UPDATE "medical_networks" AS m
SET "sortOrder" = ranked.position
FROM ranked
WHERE ranked."id" = m."id";

-- ---------------------------------------------------------------------------
-- 3. The plan names its network: the one most of its variants named, the
--    earliest-created variant breaking a tie.
-- ---------------------------------------------------------------------------
ALTER TABLE "plans" ADD COLUMN "medicalNetworkId" TEXT;

WITH named AS (
  SELECT
    c."planId",
    m."id"             AS network_id,
    count(*)           AS uses,
    min(c."createdAt") AS first_seen
  FROM "plan_configurations" AS c
  JOIN "company_medical_networks" AS old ON old."id" = c."medicalNetworkId"
  JOIN "medical_networks" AS m ON lower(btrim(m."name")) = lower(btrim(old."name"))
  GROUP BY c."planId", m."id"
),
chosen AS (
  SELECT DISTINCT ON ("planId") "planId", network_id
  FROM named
  ORDER BY "planId", uses DESC, first_seen, network_id
)
UPDATE "plans" AS p
SET "medicalNetworkId" = chosen.network_id
FROM chosen
WHERE chosen."planId" = p."id";

-- ---------------------------------------------------------------------------
-- 4. A variant that named a DIFFERENT network is a different plan now.
--
--    "Gold on the full network" and "Gold on the limited one" were two variants
--    of one plan. A plan has one network from here on, so the second becomes
--    "Gold (Limited Network)" — a plan of its own, on the network it asserted,
--    carrying its variant with every benefit and price band untouched.
--
--    A variant that named NO network simply inherits the plan's, unless that
--    would put it on top of a sibling that is otherwise identical — the case
--    the old index allowed only because NULL never collides.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE "strays" ON COMMIT DROP AS
SELECT
  c."id"   AS variant_id,
  c."planId",
  m."id"   AS network_id,
  m."name" AS network_name
FROM "plan_configurations" AS c
JOIN "plans" AS p ON p."id" = c."planId"
LEFT JOIN "company_medical_networks" AS old ON old."id" = c."medicalNetworkId"
LEFT JOIN "medical_networks" AS m ON lower(btrim(m."name")) = lower(btrim(old."name"))
WHERE
  (m."id" IS NOT NULL AND m."id" IS DISTINCT FROM p."medicalNetworkId")
  OR (
    m."id" IS NULL
    AND p."medicalNetworkId" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "plan_configurations" AS s
      WHERE s."planId" = c."planId"
        AND s."id" <> c."id"
        AND s."geographicalCoverage" = c."geographicalCoverage"
        AND s."roomType"    IS NOT DISTINCT FROM c."roomType"
        AND s."annualLimit" IS NOT DISTINCT FROM c."annualLimit"
    )
  );

INSERT INTO "plans"
  ("id", "companyId", "customerType", "name", "code", "description",
   "medicalNetworkId", "isActive", "createdAt", "updatedAt")
SELECT
  p."id" || '_' || coalesce(s.network_id, 'nonet'),
  p."companyId",
  p."customerType",
  p."name" || ' (' || coalesce(s.network_name, 'No network') || ')',
  p."code" || '-' || upper(regexp_replace(coalesce(s.network_name, 'NONET'), '[^A-Za-z0-9]+', '', 'g')),
  p."description",
  s.network_id,
  p."isActive",
  p."createdAt",
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "planId", network_id, network_name FROM "strays") AS s
JOIN "plans" AS p ON p."id" = s."planId";

UPDATE "plan_configurations" AS c
SET "planId" = s."planId" || '_' || coalesce(s.network_id, 'nonet')
FROM "strays" AS s
WHERE s.variant_id = c."id";

-- ---------------------------------------------------------------------------
-- 5. The plan points at the shared list, and survives a deletion by forgetting
--    the network rather than disappearing.
-- ---------------------------------------------------------------------------
CREATE INDEX "plans_medicalNetworkId_idx" ON "plans"("medicalNetworkId");

ALTER TABLE "plans"
  ADD CONSTRAINT "plans_medicalNetworkId_fkey"
  FOREIGN KEY ("medicalNetworkId") REFERENCES "medical_networks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. The variant stops naming a network. Its identity is now the plan, where
--    it covers, the room and the ceiling.
--
--    Dropped by every name the index has carried, for the reason the earlier
--    migrations record: a DROP that silently matches nothing leaves the old
--    index standing and refusing legitimate rows.
-- ---------------------------------------------------------------------------
ALTER TABLE "plan_configurations" DROP CONSTRAINT IF EXISTS "plan_configurations_medicalNetworkId_fkey";
DROP INDEX IF EXISTS "plan_configurations_medicalNetworkId_idx";
DROP INDEX IF EXISTS "plan_configurations_identity_key";
DROP INDEX IF EXISTS "plan_configurations_planId_customerType_geographicalCoverag_key";
DROP INDEX IF EXISTS "plan_configurations_planId_customerType_geographicalCoverage_ag";

ALTER TABLE "plan_configurations" DROP COLUMN IF EXISTS "medicalNetworkId";

CREATE UNIQUE INDEX "plan_configurations_identity_key"
  ON "plan_configurations"("planId", "geographicalCoverage", "roomType", "annualLimit");

-- ---------------------------------------------------------------------------
-- 7. The per-company rows and their typed-in provider counts go. Nothing
--    references them any more, so this cannot cascade into insurance data.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS "network_providers";
DROP TABLE IF EXISTS "company_medical_networks";
