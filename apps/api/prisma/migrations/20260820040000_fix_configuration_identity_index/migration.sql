-- Correct the configuration's identity index.
--
-- Postgres truncates identifiers at 63 characters. The previous migration's
-- `DROP INDEX IF EXISTS` named the old unique index in full, so it matched
-- nothing and the pre-age-band constraint survived — which kept refusing a
-- second age band for the same plan, customer type and coverage area. The new
-- index was truncated too, leaving an unstable name.
--
-- Drop the leftover, and give the real constraint a short name it can keep.
DROP INDEX IF EXISTS "plan_configurations_planId_customerType_geographicalCoverag_key";

ALTER INDEX IF EXISTS "plan_configurations_planId_customerType_geographicalCoverage_ag"
  RENAME TO "plan_configurations_identity_key";
