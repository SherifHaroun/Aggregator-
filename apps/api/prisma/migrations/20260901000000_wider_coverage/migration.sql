-- Coverage grows beyond Local and International.
--
-- Insurers sell wider scopes than the legacy data happened to contain, and a
-- scope nobody anticipated should not mean rewriting the application. The list
-- stays an enum because the comparison filters on it: an invented spelling
-- would quietly stop matching plans, which a table could not prevent and
-- Postgres can.
--
-- Adding values only. Nothing existing changes, so no row is touched and the
-- new values are simply available from here on.
ALTER TYPE "GeographicalCoverage" ADD VALUE IF NOT EXISTS 'LOCAL_AND_INTERNATIONAL';
ALTER TYPE "GeographicalCoverage" ADD VALUE IF NOT EXISTS 'WORLDWIDE';
ALTER TYPE "GeographicalCoverage" ADD VALUE IF NOT EXISTS 'OTHER';
