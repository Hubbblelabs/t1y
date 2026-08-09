/**
 * Error taxonomy for the REST API.
 *
 * Every error surfaced to a client passes through `AppError`, which guarantees
 * a stable machine-readable `code` and a message that is safe to display.
 * Database and runtime errors are mapped to `INTERNAL_ERROR` by the route
 * wrapper so that Prisma internals never reach a client.
 */

export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Field-level validation detail. Never contains the rejected value. */
export interface FieldIssue {
  field: string;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCodeValue;
  readonly status: number;
  readonly issues?: FieldIssue[];
  /** Additional context recorded in logs but never returned to the client. */
  readonly internal?: unknown;

  constructor(
    code: ErrorCodeValue,
    message: string,
    status: number,
    options?: { issues?: FieldIssue[]; internal?: unknown; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.issues = options?.issues;
    this.internal = options?.internal;
  }
}

export class ValidationError extends AppError {
  constructor(message = "The submitted data is invalid.", issues?: FieldIssue[]) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, { issues });
    this.name = "ValidationError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication is required.") {
    super(ErrorCode.UNAUTHENTICATED, message, 401);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(ErrorCode.FORBIDDEN, message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(ErrorCode.NOT_FOUND, `${resource} was not found.`, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "The request conflicts with the current state.") {
    super(ErrorCode.CONFLICT, message, 409);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(ErrorCode.RATE_LIMITED, "Too many requests. Please try again shortly.", 429);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(
      ErrorCode.SERVICE_UNAVAILABLE,
      `${service} is not available. Please try again later.`,
      503,
    );
    this.name = "ServiceUnavailableError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Recognises the Prisma error shapes we can translate into meaningful client
 * errors. Anything else is deliberately left to become an INTERNAL_ERROR.
 */
export function mapPrismaError(error: unknown): AppError | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const code = (error as { code: unknown }).code;
  if (typeof code !== "string") return null;

  switch (code) {
    case "P2002":
      return new ConflictError("A record with these details already exists.");
    case "P2003":
      return new ValidationError("A referenced record does not exist.");
    case "P2025":
      return new NotFoundError("Record");
    default:
      return null;
  }
}
