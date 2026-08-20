-- Benefits become GLOBAL.
--
-- Until now a benefit hung off an insurance type, so "Outpatient Care" had to
-- be created again for every type a company's plans used. A benefit is now one
-- record offered to every company and every plan; what varies per company still
-- lives in `plan_option_values`, which this migration does not touch except to
-- re-point rows whose field was consolidated.
--
-- Nothing is inserted and no coverage value is discarded: duplicates are merged
-- by moving their fields, values and attachments onto the surviving record.

-- ---------------------------------------------------------------------------
-- 1. Consolidate benefits that share a name.
--
-- Same name = same benefit, which is the only rule that can be applied without
-- a human. Anything this cannot merge without losing data raises instead, so a
-- surprising database stops the migration rather than being mangled by it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  loser      RECORD;
  survivor   TEXT;
  fld        RECORD;
  twin       TEXT;
BEGIN
  FOR loser IN
    SELECT o."id", o."name"
    FROM "insurance_options" o
    WHERE EXISTS (
      SELECT 1 FROM "insurance_options" s
      WHERE s."name" = o."name"
        AND (s."createdAt", s."id") < (o."createdAt", o."id")
    )
    ORDER BY o."name", o."createdAt", o."id"
  LOOP
    -- The oldest record with this name is the one that survives.
    SELECT s."id" INTO survivor
    FROM "insurance_options" s
    WHERE s."name" = loser."name"
    ORDER BY s."createdAt", s."id"
    LIMIT 1;

    -- A configuration can never hold both copies (a plan has one insurance
    -- type, and attaching enforced a matching type), so this cannot fire. If it
    -- somehow does, stop: merging would mean choosing which coverage to drop.
    IF EXISTS (
      SELECT 1 FROM "plan_options" p
      JOIN "plan_options" q ON q."planConfigurationId" = p."planConfigurationId"
      WHERE p."optionId" = loser."id" AND q."optionId" = survivor
    ) THEN
      RAISE EXCEPTION
        'Cannot merge benefit "%": a plan configuration holds both copies, each with its own coverage. Resolve by hand before migrating.',
        loser."name";
    END IF;

    FOR fld IN SELECT * FROM "option_fields" WHERE "optionId" = loser."id" LOOP
      SELECT g."id" INTO twin
      FROM "option_fields" g
      WHERE g."optionId" = survivor AND g."key" = fld."key"
      LIMIT 1;

      IF twin IS NOT NULL THEN
        -- The survivor already asks for this information: move the recorded
        -- values across, then retire the duplicate definition.
        UPDATE "plan_option_values" SET "optionFieldId" = twin WHERE "optionFieldId" = fld."id";
        DELETE FROM "option_fields" WHERE "id" = fld."id";
      ELSE
        -- Information only the losing copy asked for. Re-parent the field so
        -- its values travel with it rather than being deleted.
        IF EXISTS (
          SELECT 1 FROM "option_fields" g
          WHERE g."optionId" = survivor AND g."label" = fld."label"
        ) THEN
          RAISE EXCEPTION
            'Cannot merge benefit "%": field "%" exists on the surviving record under a different key. Resolve by hand before migrating.',
            loser."name", fld."label";
        END IF;
        UPDATE "option_fields" SET "optionId" = survivor WHERE "id" = fld."id";
      END IF;

      twin := NULL;
    END LOOP;

    -- Every plan that used the duplicate now points at the global benefit.
    UPDATE "plan_options" SET "optionId" = survivor WHERE "optionId" = loser."id";

    DELETE FROM "insurance_options" WHERE "id" = loser."id";
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Drop the insurance-type scope and make the name globally unique.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "insurance_options_insuranceTypeId_isActive_idx";
DROP INDEX IF EXISTS "insurance_options_insuranceTypeId_name_key";

ALTER TABLE "insurance_options" DROP CONSTRAINT IF EXISTS "insurance_options_insuranceTypeId_fkey";
ALTER TABLE "insurance_options" DROP COLUMN "insuranceTypeId";

CREATE UNIQUE INDEX "insurance_options_name_key" ON "insurance_options"("name");
CREATE INDEX "insurance_options_isActive_idx" ON "insurance_options"("isActive");
