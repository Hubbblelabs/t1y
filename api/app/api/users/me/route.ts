import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { RateLimits } from "@/lib/api/rate-limit";
import { STUDY_DIABETES_TYPE } from "@/lib/config/study-scope";
import { getCurrentUser, updateCurrentUser } from "@/lib/services/users";
import { flexibleDate, shortTextSchema, timezoneSchema } from "@/lib/validation/common";

const updateMeSchema = z
  .object({
    name: shortTextSchema(120).optional(),
    timezone: timezoneSchema.optional(),
    locale: z.string().trim().max(10).optional(),
    profile: z
      .object({
        firstName: shortTextSchema(80).optional(),
        lastName: shortTextSchema(80).optional(),
        dateOfBirth: flexibleDate.nullish(),
        sex: z
          .enum(["FEMALE", "MALE", "INTERSEX", "PREFER_NOT_TO_SAY", "UNSPECIFIED"])
          .optional(),
        phone: z.string().trim().max(32).nullish(),
        city: z.string().trim().max(80).nullish(),
        country: z.string().trim().max(80).nullish(),
        // This study is Type 1 only (BRD §1.1 inclusion criteria) — the
        // schema's DiabetesType enum still carries the platform's original
        // multi-condition values (TYPE_2, GESTATIONAL, PREDIABETES, MODY,
        // OTHER), but nothing written through this endpoint may set one.
        // UNSPECIFIED stays selectable only because it's Prisma's column
        // default for a row that hasn't captured this field yet.
        diabetesType: z.enum([STUDY_DIABETES_TYPE, "UNSPECIFIED"]).optional(),
        diagnosisYear: z.number().int().min(1900).max(new Date().getFullYear()).nullish(),
        treatmentModality: z
          .enum([
            "LIFESTYLE_ONLY",
            "ORAL_MEDICATION",
            "INSULIN",
            "ORAL_AND_INSULIN",
            "NON_INSULIN_INJECTABLE",
            "OTHER",
            "UNSPECIFIED",
          ])
          .optional(),
        heightCm: z.number().finite().min(50).max(280).nullish(),
        baselineWeightKg: z.number().finite().min(10).max(500).nullish(),
        emergencyContactName: z.string().trim().max(120).nullish(),
        emergencyContactPhone: z.string().trim().max(32).nullish(),
      })
      .optional(),
  })
  // A diagnosis year cannot precede the child's own birth year. Each field
  // was individually range-checked (1900..currentYear) but never against
  // each other, so e.g. dateOfBirth 2018 + diagnosisYear 2015 — diagnosed
  // three years before being born — passed validation silently.
  .refine(
    (data) => {
      const dob = data.profile?.dateOfBirth;
      const diagnosisYear = data.profile?.diagnosisYear;
      if (!dob || diagnosisYear == null) return true;
      return diagnosisYear >= new Date(dob).getFullYear();
    },
    {
      message: "Diagnosis year cannot be before the date of birth.",
      path: ["profile", "diagnosisYear"],
    },
  );

export const GET = defineRoute({
  handler: async ({ principal }) => ok(await getCurrentUser(principal.userId)),
});

export const PATCH = defineRoute({
  rateLimit: RateLimits.write,
  body: updateMeSchema,
  handler: async ({ principal, body }) =>
    ok(await updateCurrentUser(principal.userId, body)),
});
