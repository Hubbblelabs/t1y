import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/auth";

/**
 * Better Auth mounts its whole surface here:
 *
 *   POST /api/auth/sign-in/email
 *   POST /api/auth/sign-up/email
 *   POST /api/auth/sign-out
 *   POST /api/auth/forget-password
 *   POST /api/auth/reset-password
 *   POST /api/auth/send-verification-email
 *   GET  /api/auth/verify-email
 *   GET  /api/auth/get-session
 *
 * These endpoints use Better Auth's own response shape rather than the
 * platform envelope — documented for the Flutter developer in docs/api/.
 */
export const { GET, POST } = toNextJsHandler(auth.handler);
