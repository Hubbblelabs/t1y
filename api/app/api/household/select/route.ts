import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/lib/api/errors";
import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { resolveHousehold } from "@/lib/services/households";
import { logger } from "@/lib/utils/logger";
import { selectChildSchema } from "@/lib/validation/household";

/**
 * POST /api/household/select — step two of parent sign-in.
 *
 * Signs in as the chosen child and returns that child's bearer token, which
 * is an ordinary Better Auth session: everything downstream keeps scoping to
 * `principal.userId`, and no route has to learn what a household is.
 *
 * The identifier and password are sent again rather than carried in some
 * intermediate ticket. That keeps this endpoint independently authenticating
 * — it never trusts that step one happened — so there is no half-authorised
 * state to leak or replay.
 */

export const POST = defineRoute({
  auth: "public",
  // Same as ../children: the password in the body is the credential, and the
  // native app has no session token to send yet — see csrfExempt.
  csrfExempt: true,
  rateLimit: RateLimits.credential,
  body: selectChildSchema,
  handler: async ({ body }) => {
    const household = await resolveHousehold(body.identifier);

    const child = household.children.find(
      (c) => c.childId.toLowerCase() === body.childId.trim().toLowerCase(),
    );
    if (!child) throw new NotFoundError("That child isn't part of this household.");

    // A child the coordinator hasn't accepted yet has no study data to show,
    // and letting them in would imply an enrolment decision that hasn't been
    // made. The app surfaces the pending state from the picker instead.
    if (child.status !== "ACTIVE") {
      throw new ForbiddenError(
        "This child's enrolment is still awaiting approval by the study coordinator.",
      );
    }

    // `asResponse` returns a 401 instead of throwing one, so the status is
    // the real check here — see the matching note in ../children/route.ts.
    const response = await auth.api
      .signInEmail({
        body: { email: child.email, password: body.password },
        asResponse: true,
      })
      .catch(() => null);
    if (!response || !response.ok) {
      throw new UnauthenticatedError("Those sign-in details didn't match.");
    }

    // Better Auth reports the session token in the response body, and the
    // bearer plugin also echoes it in `set-auth-token`. Which one is
    // populated depends on how the call was made, so both are accepted
    // rather than depending on that detail staying put across upgrades.
    const payload = (await response.json().catch(() => ({}))) as { token?: string };
    const token = payload.token ?? response.headers.get("set-auth-token");
    if (!token) {
      logger.error("household.select.no_token", { status: response.status });
      throw new UnauthenticatedError("No session token was returned.");
    }

    // Carried through so the app can force the change-password screen for an
    // account still on an admin-issued temporary password — that check used
    // to live on Better Auth's own sign-in response, which the app no longer
    // calls directly.
    const account = await prisma.user.findUnique({
      where: { id: child.userId },
      select: { mustChangePassword: true },
    });

    return ok({
      token,
      mustChangePassword: account?.mustChangePassword ?? false,
      child: {
        childId: child.childId,
        name: child.name,
        icIsfUnlocked: child.icIsfUnlocked,
      },
    });
  },
});
