import { UnauthenticatedError } from "@/lib/api/errors";
import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { auth } from "@/lib/auth/auth";
import { resolveHousehold } from "@/lib/services/households";
import { householdSignInSchema } from "@/lib/validation/household";

/**
 * POST /api/household/children — step one of parent sign-in.
 *
 * Takes whatever the parent typed (their email, their phone, or one child's
 * ID) plus the password, and returns the children that identifier covers so
 * the app can show the picker. Step two is /api/household/select, which
 * signs in as the chosen child.
 *
 * The password is verified *before* any child details are returned, and this
 * is the reason the endpoint is a POST rather than a lookup: children's
 * names and dates of birth must not be readable by anyone who can guess a
 * parent's phone number.
 *
 * A child ID resolves to exactly one child, so the app skips the picker —
 * `isSingleChild` tells it so without needing to count.
 */

/** One message for every failure mode, so none of them is distinguishable. */
const SIGN_IN_FAILED = "Those sign-in details didn't match.";

export const POST = defineRoute({
  auth: "public",
  // Authenticates from the password in its own body, not from a cookie, and
  // is called by the native app before any session exists — see csrfExempt.
  csrfExempt: true,
  body: householdSignInSchema,
  handler: async ({ body }) => {
    // A missing account and a wrong password must be indistinguishable from
    // outside, or this endpoint becomes a way to discover which families are
    // enrolled in the study by trying phone numbers.
    const household = await resolveHousehold(body.identifier).catch(() => {
      throw new UnauthenticatedError(SIGN_IN_FAILED);
    });

    // Every child in a household shares the parent's password, so proving it
    // against any one of them proves it for the household. The first child
    // is used rather than a designated "primary" because there isn't one —
    // they are siblings, not a hierarchy.
    const [first] = household.children;
    if (!first) throw new UnauthenticatedError(SIGN_IN_FAILED);

    // `asResponse` makes Better Auth *return* a 401 rather than throw one,
    // so the status must be checked explicitly — a bare try/catch here would
    // treat every rejected password as a success and hand back the
    // children's names to whoever asked.
    const attempt = await auth.api
      .signInEmail({
        body: { email: first.email, password: body.password },
        asResponse: true,
      })
      .catch(() => null);

    if (!attempt || !attempt.ok) {
      // Better Auth reports "not activated yet" as EMAIL_NOT_VERIFIED,
      // because activation by the coordinator is what verifies the address.
      // That wording would read as a broken account to a parent, so it is
      // translated — and it is the one failure worth distinguishing, since
      // the password was already correct when it occurs.
      const code = attempt
        ? ((await attempt.json().catch(() => ({}))) as { code?: string }).code
        : undefined;
      throw new UnauthenticatedError(
        code === "EMAIL_NOT_VERIFIED"
          ? "Your status is yet to be updated by the admin. Thank you for your patience."
          : SIGN_IN_FAILED,
      );
    }

    return ok({
      parentName: household.parentName,
      isSingleChild: household.isSingleChild,
      children: household.children.map((child) => ({
        childId: child.childId,
        hasParticipantCode: child.hasParticipantCode,
        name: child.name,
        dateOfBirth: child.dateOfBirth,
        status: child.status,
      })),
    });
  },
});
