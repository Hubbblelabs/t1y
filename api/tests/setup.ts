// Load the real .env first so integration tests reach the development
// database; the fallbacks below only fill gaps for pure unit tests.
import "dotenv/config";

/**
 * Test bootstrap.
 *
 * Supplies the environment variables that `lib/env.ts` validates, so modules
 * that transitively touch configuration can be imported without a real `.env`.
 */
// `NODE_ENV` is typed as read-only by @types/node; assigning it in a test
// bootstrap is legitimate, so widen the type rather than skip the assignment.
const mutableEnv = process.env as Record<string, string | undefined>;

mutableEnv.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-value-at-least-32-characters";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.APP_URL ??= "http://localhost:3000";
process.env.TRUSTED_ORIGINS ??= "http://localhost:3000";
// The DB-backed limiter is not what these tests are exercising.
process.env.DISABLE_RATE_LIMIT ??= "true";
