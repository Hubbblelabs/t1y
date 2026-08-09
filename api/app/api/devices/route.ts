import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { registerDeviceSchema } from "@/lib/validation/health";
import { z } from "zod";

/**
 * Push-token registration for the Flutter application.
 *
 * A token can migrate between accounts when a device is handed over, so the
 * upsert reassigns ownership rather than failing on the unique constraint.
 */

export const POST = defineRoute({
  rateLimit: RateLimits.write,
  body: registerDeviceSchema,
  handler: async ({ principal, body }) => {
    const device = await prisma.deviceToken.upsert({
      where: { token: body.token },
      create: {
        userId: principal.userId,
        token: body.token,
        platform: body.platform,
        appVersion: body.appVersion,
      },
      update: {
        userId: principal.userId,
        platform: body.platform,
        appVersion: body.appVersion,
        isActive: true,
        lastSeenAt: new Date(),
      },
      select: { id: true, platform: true, isActive: true, lastSeenAt: true },
    });

    return ok(device);
  },
});

/** Deregisters a token, e.g. on sign-out. */
export const DELETE = defineRoute({
  rateLimit: RateLimits.write,
  body: z.object({ token: z.string().trim().min(10).max(512) }),
  handler: async ({ principal, body }) => {
    await prisma.deviceToken.updateMany({
      where: { token: body.token, userId: principal.userId },
      data: { isActive: false },
    });
    return noContent();
  },
});
