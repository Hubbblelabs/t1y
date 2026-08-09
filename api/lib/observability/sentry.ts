import * as Sentry from "@sentry/nextjs";

/**
 * Thin wrapper over Sentry so call sites do not have to care whether it is
 * configured, and so that we control exactly what leaves the system.
 *
 * Health data, request bodies and credentials are never attached — only the
 * request id, route and a short reason. The request id is also returned to the
 * client in `X-Request-Id`, which is enough to correlate a user report with an
 * event without shipping the payload.
 */

export function captureException(
  error: unknown,
  context?: { requestId?: string; path?: string; userId?: string },
): void {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  Sentry.captureException(error, {
    tags: {
      request_id: context?.requestId,
      route: context?.path,
    },
    // Identify the user by opaque id only — no email, no name.
    user: context?.userId ? { id: context.userId } : undefined,
  });
}

export function captureMessage(
  message: string,
  context?: Record<string, string | undefined>,
): void {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  Sentry.captureMessage(message, { tags: context });
}
