-- A benefit's settings belong to the benefit, and each setting owns its answers.
--
-- Two things were wrong with the shape this replaces.
--
-- First, the answer list hung off the BENEFIT rather than off the setting. A
-- benefit like inpatient cover has several settings at once — a coverage
-- percentage, a co-payment, network access, room type, ICU, what is included —
-- and one list per benefit cannot serve them: "Private room" is not an answer to
-- "what percentage", and "In-network only" says nothing about a room.
--
-- Second, limitations were a GLOBAL catalogue shared by every benefit. That put
-- "1 in 20 members ratio" in front of somebody filling in a room type, and made
-- "harsher than" a judgement across benefits that have nothing to do with each
-- other. Dental's conditions are not Optical's.
--
-- So: answers move down to the setting, and the shared catalogue becomes ordinary
-- settings on the benefits that were actually using it. NOTHING RECORDED IS LOST
-- — every limitation in use becomes an answer on a "Limitations" setting of the
-- benefit that carried it, ticked on exactly the plans that had it. An employee
-- can then rename or split that setting, which is the point: it is theirs now.

-- ---------------------------------------------------------------------------
-- 1. Answers move from the benefit down to one of its settings.
-- ---------------------------------------------------------------------------
ALTER TABLE "option_choices" ADD COLUMN "optionFieldId" TEXT;

-- The benefit's MAIN setting — the one that is not the "or ..." alternative.
UPDATE "option_choices" AS c
SET "optionFieldId" = main.id
FROM (
  SELECT DISTINCT ON ("optionId") id, "optionId"
  FROM "option_fields"
  WHERE "key" <> 'alternative'
  ORDER BY "optionId", "sortOrder", "id"
) AS main
WHERE main."optionId" = c."optionId";

-- An answer whose benefit has no setting at all is an answer to no question.
-- Only a group of benefits can be in that state, and a group holds no value.
DELETE FROM "option_choices" WHERE "optionFieldId" IS NULL;

ALTER TABLE "option_choices" ALTER COLUMN "optionFieldId" SET NOT NULL;

DROP INDEX IF EXISTS "option_choices_optionId_label_key";
DROP INDEX IF EXISTS "option_choices_optionId_sortOrder_idx";
ALTER TABLE "option_choices" DROP CONSTRAINT IF EXISTS "option_choices_optionId_fkey";
ALTER TABLE "option_choices" DROP COLUMN "optionId";

CREATE UNIQUE INDEX "option_choices_optionFieldId_label_key"
    ON "option_choices" ("optionFieldId", "label");
CREATE INDEX "option_choices_optionFieldId_sortOrder_idx"
    ON "option_choices" ("optionFieldId", "sortOrder");

ALTER TABLE "option_choices"
    ADD CONSTRAINT "option_choices_optionFieldId_fkey"
    FOREIGN KEY ("optionFieldId") REFERENCES "option_fields"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Where a setting takes several answers, which ones were ticked.
-- ---------------------------------------------------------------------------
CREATE TABLE "plan_option_value_choices" (
    "planOptionId" TEXT NOT NULL,
    "optionFieldId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_option_value_choices_pkey" PRIMARY KEY ("planOptionId", "choiceId")
);

CREATE INDEX "plan_option_value_choices_choiceId_idx"
    ON "plan_option_value_choices" ("choiceId");
CREATE INDEX "plan_option_value_choices_planOptionId_optionFieldId_idx"
    ON "plan_option_value_choices" ("planOptionId", "optionFieldId");

ALTER TABLE "plan_option_value_choices"
    ADD CONSTRAINT "plan_option_value_choices_planOptionId_fkey"
    FOREIGN KEY ("planOptionId") REFERENCES "plan_options"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_option_value_choices"
    ADD CONSTRAINT "plan_option_value_choices_optionFieldId_fkey"
    FOREIGN KEY ("optionFieldId") REFERENCES "option_fields"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_option_value_choices"
    ADD CONSTRAINT "plan_option_value_choices_choiceId_fkey"
    FOREIGN KEY ("choiceId") REFERENCES "option_choices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. The shared catalogue becomes a setting on each benefit that used it.
-- ---------------------------------------------------------------------------

-- One "Limitations" setting per benefit that actually carried any. A benefit
-- nobody restricted gains nothing: there is no question to ask about it yet.
INSERT INTO "option_fields" (
    "id", "optionId", "label", "key", "dataType", "unit", "helpText",
    "isRequired", "sortOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    used."optionId",
    'Limitations',
    'limitations',
    'MULTI',
    NULL,
    NULL,
    false,
    COALESCE(
      (SELECT MAX(f."sortOrder") + 1 FROM "option_fields" f WHERE f."optionId" = used."optionId"),
      0
    ),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT po."optionId"
    FROM "plan_option_limitations" pol
    JOIN "plan_options" po ON po."id" = pol."planOptionId"
) AS used;

-- Each wording that benefit actually used becomes an answer on that setting,
-- keeping the order it had in the shared list.
-- DISTINCT has to run BEFORE the id is generated: `gen_random_uuid()` is
-- volatile, so selecting it alongside would make every row unique and insert one
-- answer per plan that used the wording rather than one per wording.
INSERT INTO "option_choices" (
    "id", "optionFieldId", "label", "sortOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    wording."fieldId",
    wording."label",
    wording."sortOrder",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT f."id" AS "fieldId", l."name" AS "label", l."sortOrder" AS "sortOrder"
    FROM "plan_option_limitations" pol
    JOIN "plan_options" po ON po."id" = pol."planOptionId"
    JOIN "limitations" l ON l."id" = pol."limitationId"
    JOIN "option_fields" f ON f."optionId" = po."optionId" AND f."key" = 'limitations'
) AS wording;

-- And every plan that imposed it still imposes it.
INSERT INTO "plan_option_value_choices" ("planOptionId", "optionFieldId", "choiceId", "createdAt")
SELECT DISTINCT
    pol."planOptionId",
    f."id",
    c."id",
    CURRENT_TIMESTAMP
FROM "plan_option_limitations" pol
JOIN "plan_options" po ON po."id" = pol."planOptionId"
JOIN "limitations" l ON l."id" = pol."limitationId"
JOIN "option_fields" f ON f."optionId" = po."optionId" AND f."key" = 'limitations'
JOIN "option_choices" c ON c."optionFieldId" = f."id" AND c."label" = l."name";

-- ---------------------------------------------------------------------------
-- 4. The shared catalogue itself goes.
-- ---------------------------------------------------------------------------
DROP TABLE "plan_option_limitations";
DROP TABLE "limitations";
DROP TYPE "LimitationScope";
