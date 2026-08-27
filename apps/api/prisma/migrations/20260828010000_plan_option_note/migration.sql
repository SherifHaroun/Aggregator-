-- A benefit on a plan may carry a remark.
--
-- Insurance documents qualify their figures constantly: "600 EGP (1 in 10
-- members ratio)", "80% coverage for basic procedures". The figure is the
-- benefit's value; the qualification is a note about the value, and it differs
-- per configuration — the same benefit reads "1 in 10" on one plan and "1 in
-- 20" on another.
--
-- A column on the ATTACHMENT rather than a field on the benefit, because it is
-- not information the benefit requires: every attachment may carry one,
-- whatever the benefit is. Existing rows have no note, which is what NULL
-- means here — nothing is backfilled and no benefit gains a value.

ALTER TABLE "plan_options" ADD COLUMN "note" TEXT;
