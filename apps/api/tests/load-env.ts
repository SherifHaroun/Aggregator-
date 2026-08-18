/**
 * Loads `apps/api/.env` before the test files run, so `TEST_DATABASE_URL` is
 * picked up without having to pass it on the command line.
 *
 * The database integration suite stays opt-in: it skips when the variable is
 * absent, which keeps a checkout with no `.env` working.
 */
import 'dotenv/config';

/**
 * Point every test at the test database.
 *
 * Some suites boot the real Express app, which connects using `DATABASE_URL` —
 * the database the application itself uses. Redirecting it here means no test,
 * present or future, can write to real insurance data. Without
 * `TEST_DATABASE_URL` the database-backed suites skip anyway.
 */
const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
if (testDatabaseUrl) {
  process.env['DATABASE_URL'] = testDatabaseUrl;
}
