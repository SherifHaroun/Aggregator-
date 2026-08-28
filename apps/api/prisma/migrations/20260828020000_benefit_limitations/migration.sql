-- Qualifications on a benefit, made comparable.
--
-- A plan document never quotes a bare figure. It says "800 EGP for BASIC
-- PROCEDURES", "100% IN-NETWORK ONLY", "1 in 20 members ratio". Until now those
-- qualifications lived in the free-text note added by `plan_option_note`, which
-- the comparison could not read — so two plans quoting 800 EGP scored the same
-- whether one paid for everything and the other only for fillings.
--
-- A limitation therefore becomes a RECORD chosen from a catalogue. The
-- catalogue is global, like the benefit catalogue: "in-network only" is one row
-- however many plans impose it. Which limitations a plan imposes is a row in
-- `plan_option_limitations`, keyed by the ATTACHMENT — the same benefit is
-- restricted differently on one configuration than on another.
--
-- The note column stays. It records the one-off wording no catalogue entry
-- covers, and nothing is migrated out of it automatically: turning "1 in 10
-- members ratio" into a catalogue entry is a judgement about insurance data,
-- not something a migration should guess. Existing notes read exactly as before.
--
-- NO ROW MEANS NO RESTRICTION. Every benefit that exists today gains no
-- limitation row, which is precisely how unqualified cover is expressed.

CREATE TYPE "LimitationScope" AS ENUM ('VALUE', 'TEXT');

CREATE TABLE "limitations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "LimitationScope" NOT NULL DEFAULT 'VALUE',
    -- 0..1: the share of a benefit's cover the restriction removes.
    "restrictionWeight" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "limitations_pkey" PRIMARY KEY ("id")
);

-- Names are compared WITHOUT CASE, exactly as benefit names are: "In-network
-- only" and "in-network only" are one limitation to a person, so they are one
-- limitation to the database.
--
-- Unique WITHIN A SCOPE rather than globally. The two lists are separate
-- vocabularies that happen to share wording — "in-network only" qualifies a
-- percentage and also describes a network quoted in words — and neither should
-- block the other from existing.
--
-- Two indexes, for the reason `keep_prisma_name_index` gives: Prisma cannot
-- express a functional index, so the plain one is what the schema declares and
-- the folded one is what actually enforces the rule. The plain index is implied
-- by the folded one and costs nothing.
CREATE UNIQUE INDEX "limitations_scope_name_key" ON "limitations" ("scope", "name");

CREATE UNIQUE INDEX "limitations_scope_name_ci_key"
    ON "limitations" ("scope", lower("name"));

CREATE INDEX "limitations_scope_isActive_sortOrder_idx"
    ON "limitations" ("scope", "isActive", "sortOrder");

CREATE TABLE "plan_option_limitations" (
    "planOptionId" TEXT NOT NULL,
    "limitationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_option_limitations_pkey" PRIMARY KEY ("planOptionId", "limitationId")
);

CREATE INDEX "plan_option_limitations_limitationId_idx"
    ON "plan_option_limitations" ("limitationId");

-- Detaching a benefit takes its restrictions with it, as it already takes its
-- values; deleting a limitation from the catalogue removes it from the plans
-- that imposed it, which is what "this restriction no longer exists" means.
ALTER TABLE "plan_option_limitations"
    ADD CONSTRAINT "plan_option_limitations_planOptionId_fkey"
    FOREIGN KEY ("planOptionId") REFERENCES "plan_options"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plan_option_limitations"
    ADD CONSTRAINT "plan_option_limitations_limitationId_fkey"
    FOREIGN KEY ("limitationId") REFERENCES "limitations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
