import { z } from "zod";

/**
 * Public-facing content schemas — the mobile client's surface, as distinct
 * from the admin schemas in `lib/validation/admin.ts`.
 */

/**
 * The mobile client speaks lowercase BCP-47 (matching `User.locale`, which
 * defaults to "en"), not the Prisma `ContentLocale` enum's uppercase values.
 */
export const publicLocaleSchema = z
  .enum(["en", "ta"])
  .default("en")
  .transform((value) => value.toUpperCase() as "EN" | "TA");
