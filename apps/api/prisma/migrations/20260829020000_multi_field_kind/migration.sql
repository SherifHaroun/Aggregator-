-- A setting that takes SEVERAL answers, e.g. what an inpatient stay includes.
--
-- Alone in its own migration because PostgreSQL will not let a new enum value
-- be USED in the transaction that adds it. The migration that needs it follows.

ALTER TYPE "OptionFieldDataType" ADD VALUE 'MULTI';
