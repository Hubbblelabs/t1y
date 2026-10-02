import { z } from "zod";

import { idSchema } from "@/lib/validation/common";

/**
 * A phone number as someone would write it: an optional leading +, then digits
 * with spaces, dashes or brackets between them — 3 to 20 characters, which
 * covers 108 and 112 as well as a full international number.
 */
export const sosPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{2,19}$/, "Enter a phone number using digits, spaces and an optional + at the start.");

export const sosContactSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
  phone: sosPhoneSchema,
  /** Free text — "Doctor", "Nurse", anything. */
  label: z.string().trim().min(1, "Enter a tag such as Doctor or Nurse.").max(40),
  visibleToAll: z.boolean().default(false),
  active: z.boolean().default(true),
  /** Which children see this contact. Ignored while `visibleToAll` is on. */
  participantIds: z.array(idSchema).max(5000).default([]),
});

export type SosContactInput = z.infer<typeof sosContactSchema>;
