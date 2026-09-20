import { UnauthenticatedError } from "@/lib/api/errors";
import { defineRoute } from "@/lib/api/handler";
import { noContent } from "@/lib/api/response";
import { auth } from "@/lib/auth/auth";
import { resetMpin } from "@/lib/services/mpin";
import { resetMpinSchema } from "@/lib/validation/household";

/**
 * POST /api/mpin/reset — the "forgot your PIN?" path.
 *
 * The account password is the only thing that may replace a PIN. That is
 * the whole security model: the PIN is a short code that keeps a child out
 * of the data-entry screen, and the password is the real credential behind
 * it. Verifying it here re-uses Better Auth rather than comparing hashes
 * directly, so there is one implementation of "is this the password".
 */

export const POST = defineRoute({
  body: resetMpinSchema,
  handler: async ({ principal, body }) => {
    // `asResponse` returns a 401 rather than throwing it, so the status is
    // what actually proves the password — catching alone would let any
    // string through and defeat the point of asking for one.
    const verified = await auth.api
      .signInEmail({
        body: { email: principal.email, password: body.password },
        asResponse: true,
      })
      .catch(() => null);
    if (!verified || !verified.ok) throw new UnauthenticatedError("That password didn't match.");

    await resetMpin(principal.userId, body.pin);
    return noContent();
  },
});
