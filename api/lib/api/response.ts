import { NextResponse } from "next/server";

import {
  AppError,
  ErrorCode,
  type ErrorCodeValue,
  type FieldIssue,
  RateLimitError,
} from "@/lib/api/errors";

/**
 * The single response envelope used by every endpoint.
 *
 *   success: { "success": true,  "data": … , "meta"?: … }
 *   error:   { "success": false, "error": { "code", "message", "issues"? } }
 */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown> & { pagination?: PaginationMeta };
}

export interface ApiFailure {
  success: false;
  error: {
    code: ErrorCodeValue;
    message: string;
    issues?: FieldIssue[];
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** Applied to every API response: health data must not be cached anywhere. */
const NO_STORE = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
} as const;

export function ok<T>(
  data: T,
  init?: { status?: number; meta?: ApiSuccess<T>["meta"]; headers?: HeadersInit },
): NextResponse<ApiSuccess<T>> {
  const body: ApiSuccess<T> = { success: true, data };
  if (init?.meta) body.meta = init.meta;

  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { ...NO_STORE, ...init?.headers },
  });
}

export function created<T>(data: T, meta?: ApiSuccess<T>["meta"]) {
  return ok(data, { status: 201, meta });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

export function paginated<T>(
  items: T[],
  pagination: PaginationMeta,
  extraMeta?: Record<string, unknown>,
) {
  return ok(items, { meta: { ...extraMeta, pagination } });
}

export function fail(
  code: ErrorCodeValue,
  message: string,
  init?: { status?: number; issues?: FieldIssue[]; headers?: HeadersInit },
): NextResponse<ApiFailure> {
  const body: ApiFailure = { success: false, error: { code, message } };
  if (init?.issues?.length) body.error.issues = init.issues;

  return NextResponse.json(body, {
    status: init?.status ?? 400,
    headers: { ...NO_STORE, ...init?.headers },
  });
}

/** Serialises an `AppError` into the error envelope. */
export function fromAppError(error: AppError): NextResponse<ApiFailure> {
  const headers: Record<string, string> =
    error instanceof RateLimitError
      ? { "Retry-After": String(error.retryAfterSeconds) }
      : {};

  return fail(error.code, error.message, {
    status: error.status,
    issues: error.issues,
    headers,
  });
}

/** Fallback used when an unexpected error escapes a handler. */
export function internalError(): NextResponse<ApiFailure> {
  return fail(
    ErrorCode.INTERNAL_ERROR,
    "An unexpected error occurred. Please try again.",
    { status: 500 },
  );
}

export function buildPagination(
  page: number,
  pageSize: number,
  total: number,
): PaginationMeta {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
