-- Remove the plan's free-text category.
--
-- It was meant to group equivalent plans from different companies in the
-- comparison ("premium" against "premium"), but that grouping was never built:
-- the column was only ever displayed. Meanwhile `InsuranceType` became a real
-- record that scopes plans and drives the comparison, so two fields expressed
-- the same idea and only one of them did anything.
--
-- Destructive by intent: any text held here is dropped with the column.
DROP INDEX IF EXISTS "plans_category_idx";

ALTER TABLE "plans" DROP COLUMN "category";
