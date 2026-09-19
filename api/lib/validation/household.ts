import { z } from "zod";

/**
 * Sign-in, child-picker, MPIN and reward payloads.
 *
 * The MPIN schemas keep the code as a *string*, never a number: "0421" is a
 * valid PIN and `z.number()` would silently turn it into 421.
 */

export const householdSignInSchema = z.object({
  /** The parent's email, their phone, or one child's ID — see classifyIdentifier. */
  identifier: z.string().trim().min(3).max(320),
  password: z.string().min(1).max(128),
});

export const selectChildSchema = householdSignInSchema.extend({
  childId: z.string().trim().min(1).max(64),
});

export const addChildSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dateOfBirth: z.coerce.date().optional(),
  sex: z.enum(["FEMALE", "MALE", "UNSPECIFIED"]).optional(),
  diagnosisYear: z.number().int().min(1980).max(new Date().getFullYear()).optional(),
});

const pinSchema = z.string().trim().regex(/^\d{4}$/, "Enter a 4-digit PIN.");

export const setMpinSchema = z.object({ pin: pinSchema });

export const verifyMpinSchema = z.object({ pin: pinSchema });

export const resetMpinSchema = z.object({
  /** The account password — the only thing that may replace a forgotten PIN. */
  password: z.string().min(1).max(128),
  pin: pinSchema,
});
