import "server-only";

import { timingSafeEqual } from "node:crypto";

import { UnauthenticatedError } from "@/lib/api/errors";
import { env } from "@/lib/env";

/**
 * Authenticates a Vercel Cron invocation.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. The comparison is
 * constant-time so the secret cannot be recovered by timing the response.
 *
 * If `CRON_SECRET` is unset the endpoints refuse to run rather than defaulting
 * to open — an unauthenticated job endpoint would let anyone trigger a
 * platform-wide notification dispatch.
 */
export function assertCronRequest(request: Request): void {
  const secret = env.CRON_SECRET;
  if (!secret) {
    throw new UnauthenticatedError("Scheduled jobs are not configured.");
  }

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const provided = Buffer.from(header);
  const reference = Buffer.from(expected);

  if (
    provided.length !== reference.length ||
    !timingSafeEqual(provided, reference)
  ) {
    throw new UnauthenticatedError("Invalid scheduled job credentials.");
  }
}
