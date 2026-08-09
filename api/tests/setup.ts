/**
 * Test bootstrap.
 *
 * Supplies the environment variables that `lib/env.ts` validates, so modules
 * that transitively touch configuration can be imported without a real `.env`.
 */
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-value-at-least-32-characters";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.APP_URL ??= "http://localhost:3000";
process.env.TRUSTED_ORIGINS ??= "http://localhost:3000";
// The DB-backed limiter is not what unit tests are exercising.
process.env.DISABLE_RATE_LIMIT ??= "true";
