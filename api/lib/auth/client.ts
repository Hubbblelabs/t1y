"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth client for the admin dashboard.
 *
 * Talks to the same Better Auth endpoints as the mobile application, but over
 * the session cookie rather than a bearer token. No secret is involved — the
 * base URL is the app's own origin.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} = authClient;
