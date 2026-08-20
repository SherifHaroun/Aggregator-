-- Benefit names are compared WITHOUT CASE.
--
-- "Dental" and "dental" are the same benefit to a person, so they must be the
-- same benefit to the database. The API already refuses the second one, but a
-- plain unique index on "name" would still have let a direct write, an import
-- or a future client create both. This makes it impossible.
--
-- The exact spelling an employee typed is preserved; only UNIQUENESS ignores
-- case.

-- Nothing to consolidate on a database whose names already differ by more than
-- case; where two do collide, the migration stops rather than guessing which
-- spelling to keep and which coverage to discard.
DO $$
DECLARE
  clash RECORD;
BEGIN
  FOR clash IN
    SELECT lower("name") AS folded, count(*) AS copies
    FROM "insurance_options"
    GROUP BY lower("name")
    HAVING count(*) > 1
  LOOP
    RAISE EXCEPTION
      'Benefits differing only by capitalisation exist for "%": % records. Merge them by hand, then re-run this migration.',
      clash.folded, clash.copies;
  END LOOP;
END $$;

DROP INDEX IF EXISTS "insurance_options_name_key";

CREATE UNIQUE INDEX "insurance_options_name_key" ON "insurance_options" (lower("name"));
