/**
 * Loads `apps/api/.env` before the test files run, so `TEST_DATABASE_URL` is
 * picked up without having to pass it on the command line.
 *
 * The database integration suite stays opt-in: it skips when the variable is
 * absent, which keeps a checkout with no `.env` working.
 *
 * The path is resolved from THIS FILE, never from the working directory.
 * `import 'dotenv/config'` looks for `.env` beside `process.cwd()`, which is
 * wherever the command happened to be run — and when it found nothing, the
 * redirect below silently did nothing and every integration test ran against
 * the DEVELOPMENT database instead of the test one.
 */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

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
