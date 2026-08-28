-- The answers a benefit offers, in an order the employee controls.
--
-- Some cover is neither a figure nor free wording. "Golden Care Network" is a
-- NAMED TIER, and which tier a plan gives you is the whole point of the row —
-- but as free text neither the comparison nor a reader could say whether it
-- beat "Orange Care Network". Only an employee knows that, so they say it once
-- by putting the list in order, and every plan quoting a network is ranked by
-- where it sits.
--
-- The same list does a second job on an ordinary TEXT benefit, where it is
-- offered as suggestions: "Covered at authorized centers" gets typed on plan
-- after plan, each time a little differently, and thirty spellings of one
-- answer are thirty answers as far as any report is concerned.
--
-- A plan stores the CHOSEN ROW'S ID rather than its position. Storing the
-- position would silently rewrite history — reordering the list so one network
-- moved above another would change what every plan is recorded as offering.
-- Storing which row was picked means reordering changes only how good that
-- answer is judged to be, which is the entire point of being able to reorder.
--
-- Nothing is backfilled. No benefit becomes ranked, no list is invented, and
-- every existing value reads exactly as it did.

ALTER TYPE "OptionFieldDataType" ADD VALUE 'RANK';

CREATE TABLE "option_choices" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    -- Position in the list. 0 is best on a ranked benefit.
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "option_choices_pkey" PRIMARY KEY ("id")
);

-- One benefit cannot offer the same answer twice.
CREATE UNIQUE INDEX "option_choices_optionId_label_key"
    ON "option_choices" ("optionId", "label");

CREATE INDEX "option_choices_optionId_sortOrder_idx"
    ON "option_choices" ("optionId", "sortOrder");

-- The list belongs to the benefit: deleting the benefit takes its answers.
ALTER TABLE "option_choices"
    ADD CONSTRAINT "option_choices_optionId_fkey"
    FOREIGN KEY ("optionId") REFERENCES "insurance_options"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
