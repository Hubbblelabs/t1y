import "server-only";

import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins/bearer";

import { prisma } from "@/lib/db/prisma";
import { env, isProduction, trustedOrigins } from "@/lib/env";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/notifications/email";
import { logger } from "@/lib/utils/logger";

/**
 * Authentication for both surfaces of the application:
 *
 *  - The admin dashboard authenticates with an httpOnly session cookie.
 *  - The Flutter application authenticates with a bearer token. The `bearer`
 *    plugin returns the session token in the `set-auth-token` response header
 *    on sign-in, and accepts `Authorization: Bearer <token>` afterwards, so the
 *    mobile client never has to deal with cookies.
 *
 * Roles are stored on `User.role` and are NOT writable through the sign-up API
 * (`input: false`) — a self-registering user is always a PATIENT. Staff roles
 * are granted only through the administrators module.
 */

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * The password rule, decided by the study team: at least 8 characters, with
 * both letters and numbers. No capitals or symbols are demanded. Checked on
 * every path that sets a password; the app checks the same thing first so a
 * family sees the reason before sending.
 */
export const PASSWORD_RULE_MESSAGE =
  "Use at least 8 characters, with both letters and numbers.";

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string") return null;
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return PASSWORD_RULE_MESSAGE;
  }
  return null;
}

const PASSWORD_PATHS = new Set(["/sign-up/email", "/change-password", "/reset-password"]);

export const auth = betterAuth({
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!PASSWORD_PATHS.has(ctx.path)) return;
      const body = (ctx.body ?? {}) as { password?: unknown; newPassword?: unknown };
      const problem = passwordProblem(ctx.path === "/sign-up/email" ? body.password : body.newPassword);
      if (problem) throw new APIError("BAD_REQUEST", { message: problem });
    }),
  },

  appName: "Digital Diabetes Management Platform",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  }),

  trustedOrigins: trustedOrigins(),

  emailAndPassword: {
    enabled: true,
    // A self-registered family is usable the moment they sign up (see
    // `status.defaultValue` below) — there is no coordinator gate left on
    // this path for email verification to stand in for, so it no longer
    // blocks sign-in either.
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, name: user.name, url });
    },
    onPasswordReset: async ({ user }) => {
      logger.info("auth.password_reset_completed", { userId: user.id });
    },
  },

  emailVerification: {
    // Nothing downstream depends on this being proven any more — see
    // requireEmailVerification above — so there is no reason to send it.
    sendOnSignUp: false,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, name: user.name, url });
    },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "PATIENT",
        // Prevents privilege escalation through the public sign-up payload.
        input: false,
      },
      status: {
        type: "string",
        required: false,
        // Self-registration no longer waits on a study coordinator to admit
        // the family — a fresh account is usable the moment it's created.
        // (Participants created from the admin side still start PENDING —
        // see createParticipant in lib/services/participants.ts, which sets
        // this explicitly rather than relying on the field default.)
        defaultValue: "ACTIVE",
        input: false,
      },
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      timezone: { type: "string", required: false, defaultValue: "UTC", input: true },
      locale: { type: "string", required: false, defaultValue: "en", input: true },
      lastLoginAt: { type: "date", required: false, input: false },
      deletedAt: { type: "date", required: false, input: false },
    },
  },

  session: {
    expiresIn: SESSION_MAX_AGE_SECONDS,
    updateAge: 60 * 60 * 24, // refresh the expiry at most once a day
    freshAge: 60 * 15, // re-authentication window for sensitive operations
    cookieCache: {
      // Avoids a database read on every request; short enough that a revoked
      // session stops working quickly.
      enabled: true,
      maxAge: 60,
    },
  },

  account: {
    accountLinking: { enabled: false },
  },

  advanced: {
    cookiePrefix: "ddmp",
    useSecureCookies: isProduction(),
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction(),
      path: "/",
    },
  },

  rateLimit: {
    enabled: true,
    // Shared across serverless instances; in-memory would not be.
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      // Wrong passwords are never counted or locked out, by decision of the study team.
      "/sign-in/email": false,
      "/sign-up/email": { window: 3600, max: 5 },
      "/forget-password": { window: 3600, max: 5 },
      "/reset-password": { window: 3600, max: 8 },
      "/send-verification-email": { window: 3600, max: 5 },
    },
  },

  plugins: [
    bearer(),
    // Must stay last: it writes Set-Cookie headers for Server Actions.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
