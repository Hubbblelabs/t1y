import "server-only";

import { z } from "zod";

/**
 * Server-side environment configuration.
 *
 * Optional integrations (Cloudinary, Resend, Sentry) are validated but not required, so
 * the application still boots in environments where they are not configured.
 * Call the `isXConfigured` helpers before using them.
 *
 * Nothing in this module may be imported from a Client Component — every value
 * here is a server secret.
 */

const booleanish = z
  .string()
  .transform((value) => ["1", "true", "yes", "on"].includes(value.toLowerCase()));

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_DATABASE_URL: z.string().min(1).optional(),

  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  APP_URL: z.url().default("http://localhost:3000"),
  TRUSTED_ORIGINS: z.string().default("http://localhost:3000"),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Diabetes Platform <no-reply@example.com>"),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  SENTRY_DSN: z.string().optional(),

  CRON_SECRET: z.string().optional(),

  SEED_DEFAULT_PASSWORD: z.string().optional(),

  /** Disables the API rate limiter. Intended for automated tests only. */
  DISABLE_RATE_LIMIT: booleanish.optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

function load(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    // Report the variable names only. Never echo values — they are secrets.
    const missing = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n  ");
    throw new Error(
      `Invalid environment configuration:\n  ${missing}\n\n` +
        "Copy .env.example to .env and fill in the required values.",
    );
  }

  return parsed.data;
}

/**
 * Validated server environment. Lazily parsed so that importing a module which
 * transitively touches `env` does not crash tooling that runs without a `.env`.
 */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string) {
    cached ??= load();
    return cached[prop as keyof ServerEnv];
  },
});

export function trustedOrigins(): string[] {
  return env.TRUSTED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

export function isStorageConfigured(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  );
}

export function isProduction(): boolean {
  return env.NODE_ENV === "production";
}
