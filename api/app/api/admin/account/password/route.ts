import { APIError } from "better-auth/api";

import { ValidationError } from "@/lib/api/errors";
import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent } from "@/lib/api/response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { changeOwnPasswordSchema } from "@/lib/validation/admin";

/**
 * POST /api/admin/account/password
 *
 * A signed-in staff member changes their own password. This is also how a
 * temporary password given out at account creation is replaced: it clears the
 * "must change password" mark.
 */
export const POST = defineRoute({
  rateLimit: RateLimits.adminWrite,
  body: changeOwnPasswordSchema,
  handler: async ({ request, principal, body }) => {
    if (body.newPassword === body.currentPassword) {
      throw new ValidationError("Choose a password different from your current one.");
    }

    try {
      await auth.api.changePassword({
        headers: request.headers,
        body: {
          currentPassword: body.currentPassword,
          newPassword: body.newPassword,
          revokeOtherSessions: true,
        },
      });
    } catch (error) {
      if (error instanceof APIError) {
        throw new ValidationError("Your current password is not right.");
      }
      throw error;
    }

    await prisma.user.update({
      where: { id: principal.userId },
      data: { mustChangePassword: false },
    });

    return noContent();
  },
});
