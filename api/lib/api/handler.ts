import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { z } from "zod";

import {
  AppError,
  ForbiddenError,
  UnauthenticatedError,
  ValidationError,
  type FieldIssue,
  isAppError,
  mapPrismaError,
} from "@/lib/api/errors";
import {
  enforceRateLimit,
  rateLimitHeaders,
  RateLimits,
  type RateLimitRule,
} from "@/lib/api/rate-limit";
import { fromAppError, internalError } from "@/lib/api/response";
import { getPrincipalFromRequest, type Principal } from "@/lib/auth/session";
import { requestContextFrom, type RequestContext } from "@/lib/audit/audit";
import { trustedOrigins } from "@/lib/env";
import { assertCan } from "@/lib/permissions/policies";
import type { CapabilityValue } from "@/lib/permissions/roles";
import { logger } from "@/lib/utils/logger";
import { captureException } from "@/lib/observability/sentry";

/**
 * The single entry point for every route handler.
 *
 * It guarantees, in order: rate limiting, CSRF origin checking, authentication,
 * capability authorisation, then input validation — before any handler code
 * runs. A route cannot accidentally skip a step, because there is no other way
 * to declare one.
 *
 * Errors are normalised here too: `AppError`s become their envelope, known
 * Prisma failures are translated, and anything else becomes a generic 500 with
 * the details sent to Sentry rather than to the client.
 */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MAX_BODY_BYTES = 1_000_000; // 1 MB — file bytes go direct to R2, not here.

type AuthMode = "required" | "optional" | "public";

/** Context handed to a route implementation once all checks have passed. */
export interface RouteContext<TBody, TQuery, TParams> {
  request: NextRequest;
  body: TBody;
  query: TQuery;
  params: TParams;
  principal: Principal;
  requestId: string;
  audit: RequestContext;
}

/** Same as `RouteContext` but with a possibly-absent principal. */
export interface PublicRouteContext<TBody, TQuery, TParams>
  extends Omit<RouteContext<TBody, TQuery, TParams>, "principal"> {
  principal: Principal | null;
}

interface RouteConfig<TBody, TQuery, TParams, TAuth extends AuthMode> {
  /** Defaults to "required". */
  auth?: TAuth;
  /** Capability the principal must hold. Implies `auth: "required"`. */
  capability?: CapabilityValue;
  /** Requires a verified email address. Defaults to true for authenticated routes. */
  requireVerifiedEmail?: boolean;
  rateLimit?: RateLimitRule;
  body?: z.ZodType<TBody>;
  query?: z.ZodType<TQuery>;
  params?: z.ZodType<TParams>;
  handler: (
    context: TAuth extends "required"
      ? RouteContext<TBody, TQuery, TParams>
      : PublicRouteContext<TBody, TQuery, TParams>,
  ) => Promise<Response> | Response;
}

type NextRouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response>;

export function defineRoute<
  TBody = undefined,
  TQuery = undefined,
  TParams = undefined,
  TAuth extends AuthMode = "required",
>(config: RouteConfig<TBody, TQuery, TParams, TAuth>): NextRouteHandler {
  return async function handle(request, routeContext) {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    const audit = requestContextFrom(request, requestId);
    const authMode: AuthMode = config.capability ? "required" : (config.auth ?? "required");

    let rateLimitInfo: ReturnType<typeof rateLimitHeaders> = {};

    try {
      // --- 1. CSRF ---------------------------------------------------------
      // Cookie-authenticated mutations must originate from a trusted origin.
      // Bearer-token callers (the Flutter app) are not cookie-driven and so are
      // not exposed to CSRF.
      if (MUTATING_METHODS.has(request.method) && !hasBearerToken(request)) {
        assertTrustedOrigin(request);
      }

      // --- 2. Authentication ----------------------------------------------
      const principal =
        authMode === "public" ? null : await getPrincipalFromRequest(request);

      if (authMode === "required" && !principal) {
        throw new UnauthenticatedError();
      }

      if (principal) {
        const needsVerification = config.requireVerifiedEmail ?? true;
        if (needsVerification && !principal.emailVerified) {
          throw new ForbiddenError(
            "Verify your email address before continuing.",
          );
        }
      }

      // --- 3. Rate limiting -------------------------------------------------
      const rule =
        config.rateLimit ?? (principal ? RateLimits.read : RateLimits.anonymous);
      const subject = principal
        ? `user:${principal.userId}`
        : `ip:${audit.ipAddress ?? "unknown"}`;
      rateLimitInfo = rateLimitHeaders(await enforceRateLimit(subject, rule));

      // --- 4. Authorisation -------------------------------------------------
      if (config.capability && principal) {
        assertCan(principal, config.capability);
      }

      // --- 5. Validation ----------------------------------------------------
      const rawParams = await routeContext.params;
      const params = config.params
        ? parseOrThrow(config.params, rawParams, "path")
        : (undefined as TParams);

      const query = config.query
        ? parseOrThrow(
            config.query,
            searchParamsToObject(request.nextUrl.searchParams),
            "query",
          )
        : (undefined as TQuery);

      const body = config.body
        ? parseOrThrow(config.body, await readJsonBody(request), "body")
        : (undefined as TBody);

      // --- 6. Handler -------------------------------------------------------
      const response = await config.handler({
        request,
        body,
        query,
        params,
        principal: principal as Principal,
        requestId,
        audit,
      } as never);

      for (const [key, value] of Object.entries(rateLimitInfo)) {
        response.headers.set(key, value);
      }
      response.headers.set("X-Request-Id", requestId);
      return response;
    } catch (error) {
      return handleError(error, {
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        durationMs: Date.now() - started,
        rateLimitInfo,
      });
    }
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function hasBearerToken(request: NextRequest): boolean {
  return request.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

function assertTrustedOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");

  // Same-origin fetches from some clients omit `Origin`; fall back to `Referer`.
  const referer = request.headers.get("referer");
  const candidate = origin ?? (referer ? safeOrigin(referer) : null);

  if (!candidate) {
    // No origin information at all on a cookie-authenticated mutation.
    throw new ForbiddenError("Request origin could not be verified.");
  }

  const allowed = [...trustedOrigins(), request.nextUrl.origin];
  if (!allowed.includes(candidate)) {
    throw new ForbiddenError("Request origin is not permitted.");
  }
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Repeated query keys collapse into an array so schemas can accept either
 * `?status=A` or `?status=A&status=B`.
 */
function searchParamsToObject(params: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }
  return result;
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ValidationError("Request body must be JSON (application/json).");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new ValidationError("Request body is too large.");
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new ValidationError("Request body is too large.");
  }
  if (!text.trim()) {
    throw new ValidationError("Request body is required.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("Request body is not valid JSON.");
  }
}

function parseOrThrow<T>(
  schema: z.ZodType<T>,
  value: unknown,
  source: "body" | "query" | "path",
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const issues: FieldIssue[] = result.error.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join(".") : source,
    message: issue.message,
  }));

  const label =
    source === "body"
      ? "The submitted data is invalid."
      : source === "query"
        ? "One or more query parameters are invalid."
        : "The request path is invalid.";

  throw new ValidationError(label, issues);
}

function handleError(
  error: unknown,
  context: {
    requestId: string;
    method: string;
    path: string;
    durationMs: number;
    rateLimitInfo: Record<string, string>;
  },
): Response {
  const withHeaders = (response: NextResponse) => {
    for (const [key, value] of Object.entries(context.rateLimitInfo)) {
      response.headers.set(key, value);
    }
    response.headers.set("X-Request-Id", context.requestId);
    return response;
  };

  if (isAppError(error)) {
    // Expected, client-visible failures. Only log the interesting ones.
    if (error.status >= 500) {
      logger.error("api.error", {
        requestId: context.requestId,
        code: error.code,
        path: context.path,
        method: context.method,
      });
      captureException(error, { requestId: context.requestId, path: context.path });
    } else if (error.status === 401 || error.status === 403 || error.status === 429) {
      logger.warn("api.denied", {
        requestId: context.requestId,
        code: error.code,
        path: context.path,
        method: context.method,
      });
    }
    return withHeaders(fromAppError(error));
  }

  const prismaError = mapPrismaError(error);
  if (prismaError) {
    logger.warn("api.database_constraint", {
      requestId: context.requestId,
      code: prismaError.code,
      path: context.path,
    });
    return withHeaders(fromAppError(prismaError));
  }

  // Unknown failure: report internally, return an opaque message.
  logger.error("api.unhandled", {
    requestId: context.requestId,
    path: context.path,
    method: context.method,
    durationMs: context.durationMs,
    reason: error instanceof Error ? error.message : "unknown",
  });
  captureException(error, { requestId: context.requestId, path: context.path });

  return withHeaders(internalError());
}

/** Wraps a non-`AppError` thrown by a service so it maps to a clean 500. */
export function unexpected(message: string, cause?: unknown): AppError {
  return new AppError("INTERNAL_ERROR", message, 500, { cause });
}
