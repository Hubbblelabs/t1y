/**
 * What this deployment of the admin CMS is actually for.
 *
 * The backend schema was built for a generic "Digital Diabetes Management
 * Platform" (see docs/UNUSED-BACKEND.md) and this deployment serves one
 * specific study — T1D Prajana Yandra, 8 bilingual curriculum topics,
 * Type 1 diabetes only. Several enum values and form options that make
 * sense for the general platform have no meaning here: an editor choosing
 * "Medication" or "Gestational" while authoring this study's content is
 * always a mistake, not a valid choice.
 *
 * Rather than deleting those enum values (a schema migration touching
 * code paths this deployment doesn't use, but a future non-study
 * deployment might), this file is the single place that flags which
 * options are actually relevant here. Admin forms read from it to label
 * or group out-of-scope choices instead of presenting a flat list where
 * every option looks equally valid.
 */

import type { EducationCategory } from "@/generated/prisma/enums";

/** Categories the imported curriculum's 8 topics actually use — see content/manifest.json. */
export const STUDY_EDUCATION_CATEGORIES: EducationCategory[] = [
  "INSULIN",
  "GLUCOSE_MANAGEMENT",
  "HYPOGLYCAEMIA",
  "NUTRITION",
  "EXERCISE",
  "TRAVEL",
  "SCHOOL_MANAGEMENT",
  "GENERAL_WELLNESS",
];

/**
 * Every value the schema defines but this study has no content for —
 * inherited from the platform's original multi-condition scope. Kept
 * selectable (an editor may legitimately need one someday) but visually
 * separated so they don't look like part of this study's curriculum.
 */
export const LEGACY_EDUCATION_CATEGORIES: EducationCategory[] = [
  "DIABETES_BASICS",
  "MEDICATION",
  "LIFESTYLE",
  "STRESS_MANAGEMENT",
  "DIABAG",
];

/** This study's inclusion criteria is Type 1 diabetes only (BRD §1.1). */
export const STUDY_DIABETES_TYPE = "TYPE_1" as const;
