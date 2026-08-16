/**
 * Loads `apps/api/.env` before the test files run, so `TEST_DATABASE_URL` is
 * picked up without having to pass it on the command line.
 *
 * The database integration suite stays opt-in: it skips when the variable is
 * absent, which keeps a checkout with no `.env` working.
 */
import 'dotenv/config';
