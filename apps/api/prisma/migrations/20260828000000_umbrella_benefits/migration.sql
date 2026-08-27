-- A benefit may now GROUP other benefits.
--
-- "Life & Accident Coverage" is not one figure; it is death, disability and
-- the rest, each with its own value. Until now the catalogue was flat, so such
-- a benefit had to be entered as several unrelated rows. A benefit can now be
-- an umbrella — carrying no value itself — with sub-benefits pointing at it.
--
-- Existing benefits are untouched: every one of them stays a top-level benefit
-- carrying its own value, which is what `false` and `NULL` mean here.

ALTER TABLE "insurance_options" ADD COLUMN "isUmbrella" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "insurance_options" ADD COLUMN "parentId" TEXT;

-- An umbrella cannot be deleted while sub-benefits still name it.
ALTER TABLE "insurance_options"
  ADD CONSTRAINT "insurance_options_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "insurance_options"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- A benefit is never its own parent, and only an umbrella may be a parent —
-- the second half of which the service enforces, since SQL cannot see the row
-- it points at. What the database guarantees is the part that would corrupt
-- the tree: no self-parenting.
ALTER TABLE "insurance_options"
  ADD CONSTRAINT "insurance_options_parent_not_self_check"
  CHECK ("parentId" IS NULL OR "parentId" <> "id");

-- Sub-benefits are read and rendered in their umbrella's order.
CREATE INDEX "insurance_options_parentId_sortOrder_idx"
  ON "insurance_options" ("parentId", "sortOrder");
