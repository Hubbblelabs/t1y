/**
 * Stand-in for the `server-only` package during tests.
 *
 * The real module throws unless it is imported from a React Server Component,
 * which would make every service module impossible to unit test.
 */
export {};
