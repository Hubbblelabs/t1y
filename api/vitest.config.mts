import { defineConfig } from "vitest/config";

/**
 * Test configuration.
 *
 * `server-only` is aliased to an empty module: the real package throws when
 * imported outside a React Server Component, which would make every service
 * module untestable.
 *
 * Integration tests need the development database, so they are excluded unless
 * `RUN_INTEGRATION_TESTS=1`. That keeps `npm test` fast and runnable without one.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: [
      "node_modules/**",
      ".next/**",
      ...(process.env.RUN_INTEGRATION_TESTS === "1" ? [] : ["tests/integration/**"]),
    ],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: ".vitest/coverage",
      include: ["lib/**/*.ts"],
    },
  },
});
