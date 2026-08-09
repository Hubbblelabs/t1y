import "server-only";

import { RateLimitError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/utils/logger";

/**
 * Fixed-window rate limiter backed by Postgres.
 *
 * Serverless instances do not share memory, so an in-process counter would let
 * a caller multiply their quota by the number of warm lambdas. A single row per
 * (bucket, subject, window) keeps the limit global.
 *
 * The window boundary is derived from the clock rather than stored, so an
 * expired row is simply overwritten — no cleanup job is required on the hot
 * path (a daily cron prunes stale rows).
 */

export interface RateLimitRule {
  /** Distinguishes independent quotas, e.g. "auth", "write", "export". */
  bucket: string;
  limit: number;
  windowSeconds: number;
}

export const RateLimits = {
  /** Default for authenticated reads. */
  read: { bucket: "read", limit: 300, windowSeconds: 60 },
  /** Health-data writes from the mobile client. */
  write: { bucket: "write", limit: 120, windowSeconds: 60 },
  /** Administrative mutations. */
  adminWrite: { bucket: "admin-write", limit: 60, windowSeconds: 60 },
  /** Expensive operations — exports and report generation. */
  export: { bucket: "export", limit: 10, windowSeconds: 300 },
  /** Unauthenticated endpoints, keyed by IP. */
  anonymous: { bucket: "anon", limit: 30, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
  resetAt: Date;
}

/**
 * Consumes one unit from the caller's quota.
 *
 * If the datastore is unreachable the request is allowed through: a rate
 * limiter that fails closed would turn a database blip into a full outage.
 */
export async function consumeRateLimit(
  subject: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const limit = rule.limit;

  if (env.DISABLE_RATE_LIMIT) {
    return {
      allowed: true,
      remaining: limit,
      limit,
      retryAfterSeconds: 0,
      resetAt: new Date(),
    };
  }

  const windowMs = rule.windowSeconds * 1000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = new Date(windowStart + windowMs);
  const key = `${rule.bucket}:${subject}:${windowStart}`;

  try {
    // `upsert` is atomic here: the primary key collides for concurrent callers
    // in the same window, so the increment path runs under a row lock.
    const record = await prisma.apiRateLimit.upsert({
      where: { key },
      create: { key, count: 1, expiresAt: resetAt },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    const remaining = Math.max(0, limit - record.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));

    return {
      allowed: record.count <= limit,
      remaining,
      limit,
      retryAfterSeconds,
      resetAt,
    };
  } catch (error) {
    logger.warn("rate_limit.unavailable", {
      bucket: rule.bucket,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return {
      allowed: true,
      remaining: limit,
      limit,
      retryAfterSeconds: 0,
      resetAt,
    };
  }
}

export async function enforceRateLimit(
  subject: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const result = await consumeRateLimit(subject, rule);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSeconds);
  }
  return result;
}

/** Headers advertising the caller's remaining quota. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt.getTime() / 1000)),
  };
}

/** Removes expired rows. Invoked by the daily maintenance cron. */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await prisma.apiRateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
