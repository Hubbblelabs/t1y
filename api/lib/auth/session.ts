import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { UnauthenticatedError } from "@/lib/api/errors";
import type { UserRole, UserStatus } from "@/generated/prisma/enums";

/**
 * The authenticated principal, in the shape the permission layer expects.
 * Deliberately small: nothing here is health data.
 */
export interface Principal {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  timezone: string;
  sessionId: string;
}

/**
 * Resolves the current session from either the session cookie (admin) or an
 * `Authorization: Bearer` header (Flutter). Returns `null` when unauthenticated.
 *
 * Wrapped in React `cache` so that a single server render or request resolves
 * the session once, no matter how many components or helpers ask for it.
 */
export const getPrincipal = cache(async (): Promise<Principal | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !session.session) return null;

  const user = session.user as typeof session.user & {
    role?: string | null;
    status?: string | null;
    timezone?: string | null;
  };

  // A suspended or soft-deleted account must not authenticate, even with a
  // technically valid session token.
  const status = (user.status ?? "PENDING") as UserStatus;
  if (status === "SUSPENDED" || status === "INACTIVE") return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: (user.role ?? "PATIENT") as UserRole,
    status,
    emailVerified: user.emailVerified,
    timezone: user.timezone ?? "UTC",
    sessionId: session.session.id,
  };
});

/** Like `getPrincipal`, but throws `UnauthenticatedError` instead of returning null. */
export async function requirePrincipal(): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal) throw new UnauthenticatedError();
  return principal;
}

/** Resolves a principal from an explicit `Request` (used by route handlers). */
export async function getPrincipalFromRequest(
  request: Request,
): Promise<Principal | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user || !session.session) return null;

  const user = session.user as typeof session.user & {
    role?: string | null;
    status?: string | null;
    timezone?: string | null;
  };

  const status = (user.status ?? "PENDING") as UserStatus;
  if (status === "SUSPENDED" || status === "INACTIVE") return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: (user.role ?? "PATIENT") as UserRole,
    status,
    emailVerified: user.emailVerified,
    timezone: user.timezone ?? "UTC",
    sessionId: session.session.id,
  };
}
