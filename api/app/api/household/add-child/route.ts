import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { created, ok } from "@/lib/api/response";
import { addChild, listSiblings } from "@/lib/services/households";
import { addChildSchema } from "@/lib/validation/household";

/**
 * GET  /api/household/add-child — the signed-in child's siblings, for the
 *      in-app picker and the profile screen's "your children" list.
 * POST /api/household/add-child — enrol another child under this household.
 *
 * The new account is created PENDING: a parent may add a child, but only the
 * study coordinator admits one, so the child appears in the picker marked as
 * awaiting approval rather than immediately usable.
 */

export const GET = defineRoute({
  handler: async ({ principal }) => {
    const siblings = await listSiblings(principal.userId);
    return ok(
      siblings.map((child) => ({
        childId: child.childId,
        hasParticipantCode: child.hasParticipantCode,
        name: child.name,
        dateOfBirth: child.dateOfBirth,
        status: child.status,
        isCurrent: child.userId === principal.userId,
      })),
    );
  },
});

export const POST = defineRoute({
  rateLimit: RateLimits.write,
  body: addChildSchema,
  handler: async ({ principal, body }) =>
    created(
      await addChild({
        requestedByUserId: principal.userId,
        name: body.name,
        dateOfBirth: body.dateOfBirth,
        sex: body.sex,
        diagnosisYear: body.diagnosisYear,
      }),
    ),
});
