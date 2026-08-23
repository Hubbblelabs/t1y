import "server-only";

import { betterAuth } from "better-auth";
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

export const auth = betterAuth({
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
    // Health data is only reachable after the address is proven.
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: false,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, name: user.name, url });
    },
    onPasswordReset: async ({ user }) => {
      logger.info("auth.password_reset_completed", { userId: user.id });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
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
        defaultValue: "PENDING",
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
      "/sign-in/email": { window: 300, max: 8 },
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
