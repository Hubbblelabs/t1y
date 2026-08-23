import "server-only";

import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/api/errors";

/**
 * Feature flags.
 *
 * Deliberately not modelled on `SystemSetting` (see lib/services/settings.ts):
 * that store's closed `SETTING_DEFAULTS` allowlist and SUPER_ADMIN-only read
 * path are both correct for operational settings, but flags need a
 * PATIENT-readable surface (the mobile splash screen reads
 * content_lang_ta_enabled before sign-in) and per-flag safety metadata that
 * doesn't belong in a JSON blob.
 *
 * This registry mirrors SETTING_DEFAULTS' pattern: it is the single source of
 * truth for which keys are valid, so `setFeatureFlags` can still reject
 * unknown keys rather than accumulating junk rows.
 */

export interface FeatureFlagDefinition {
  default: boolean;
  description: string;
  publicRead: boolean;
  clinicalSafety: boolean;
  safetyNotice?: string;
}

export const FEATURE_FLAGS = {
  content_lang_ta_enabled: {
    default: false,
    publicRead: true,
    clinicalSafety: false,
    description: "Shows Tamil-language education content and lets the client request locale=ta.",
  },
  quizzes_enabled: {
    default: false,
    publicRead: true,
    clinicalSafety: false,
    description: "Shows the Quizzes tab and quiz completion prompts.",
  },
  offline_sync_enabled: {
    default: true,
    publicRead: true,
    clinicalSafety: false,
    description: "Master switch for the offline progress/quiz sync pipeline.",
  },
  ic_isf_calculator: {
    default: false,
    publicRead: true,
    clinicalSafety: true,
    description: "Insulin-to-carb and correction-factor calculator.",
    safetyNotice:
      "Displays insulin dosing guidance derived from parent-entered ratios. Confirm clinical " +
      "sign-off for this cohort before enabling.",
  },
  /**
   * Gates every PATIENT-writable health-logging endpoint (glucose, insulin,
   * meals, medication logs, HbA1c, health metrics). Off by default: this
   * study's v1 is education-only (curriculum + calculators + quizzes) — the
   * Flutter app has no logging screens at all, so nothing should be able to
   * write this data regardless. This flag is the difference between "no UI
   * exists yet" and "the API actually refuses it" — ethics approval for an
   * education study very likely doesn't cover collecting glucose readings,
   * so the API shouldn't quietly accept them from some other client either.
   */
  health_logging_enabled: {
    default: false,
    publicRead: false,
    clinicalSafety: true,
    description: "Allows participants to write glucose, insulin, meal, medication and HbA1c logs.",
    safetyNotice:
      "This study's ethics approval covers an education app, not health-data collection. " +
      "Confirm ethics-committee sign-off before enabling.",
  },
  glucagon_dose_calculator: {
    default: false,
    publicRead: true,
    clinicalSafety: true,
    description: "Emergency paediatric glucagon dosing reference.",
    safetyNotice:
      "Displays an emergency paediatric glucagon dose. This is clinical content reaching a " +
      "child's caregiver directly — confirm clinical sign-off before enabling.",
  },
} as const satisfies Record<string, FeatureFlagDefinition>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

function isFeatureFlagKey(key: string): key is FeatureFlagKey {
  return key in FEATURE_FLAGS;
}

/** Every registered flag's current value, resolving to its default when no row exists yet. */
export async function getFeatureFlags(): Promise<
  Record<FeatureFlagKey, { enabled: boolean; description: string; clinicalSafety: boolean; safetyNotice?: string; updatedAt: Date | null }>
> {
  const rows = await prisma.featureFlag.findMany();
  const byKey = new Map(rows.map((row) => [row.key, row]));

  const result = {} as Record<
    FeatureFlagKey,
    { enabled: boolean; description: string; clinicalSafety: boolean; safetyNotice?: string; updatedAt: Date | null }
  >;

  for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) {
    const definition: FeatureFlagDefinition = FEATURE_FLAGS[key];
    const row = byKey.get(key);
    result[key] = {
      enabled: row?.enabled ?? definition.default,
      description: definition.description,
      clinicalSafety: definition.clinicalSafety,
      safetyNotice: definition.safetyNotice,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  return result;
}

/**
 * Only the `publicRead` flags, as a flat boolean map — what
 * `GET /api/feature-flags` returns to a PATIENT (or unauthenticated splash
 * screen) principal.
 */
export async function getPublicFeatureFlags(): Promise<{
  flags: Record<string, boolean>;
  fetchedAt: string;
  maxAgeSeconds: number;
}> {
  const all = await getFeatureFlags();
  const flags: Record<string, boolean> = {};

  for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) {
    if (FEATURE_FLAGS[key].publicRead) flags[key] = all[key].enabled;
  }

  return {
    flags,
    fetchedAt: new Date().toISOString(),
    // Short TTL specifically so a stale cached `true` on a clinicalSafety
    // flag doesn't outlive an admin switching it off for long. The client is
    // expected to treat any clinicalSafety flag older than this as `false`
    // (fail-safe) — this is documented, not enforced, since the server has
    // no way to reach into a device's cache.
    maxAgeSeconds: 60 * 60,
  };
}

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({ where: { key } });
  return row?.enabled ?? FEATURE_FLAGS[key].default;
}

export async function setFeatureFlags(
  updates: Record<string, boolean>,
  updatedById: string,
  opts: { acknowledgedClinicalSafety: boolean },
): Promise<{ updated: FeatureFlagKey[]; rejected: string[] }> {
  const updated: FeatureFlagKey[] = [];
  const rejected: string[] = [];

  for (const [key, enabled] of Object.entries(updates)) {
    if (!isFeatureFlagKey(key)) {
      rejected.push(key);
      continue;
    }

    const definition: FeatureFlagDefinition = FEATURE_FLAGS[key];
    if (definition.clinicalSafety && enabled && !opts.acknowledgedClinicalSafety) {
      throw new ValidationError(
        `"${key}" gates clinical content and requires explicit safety acknowledgement to enable.`,
        [{ field: "acknowledgeClinicalSafety", message: "Required to enable a clinical-safety flag." }],
      );
    }

    await prisma.featureFlag.upsert({
      where: { key },
      create: {
        key,
        enabled,
        description: definition.description,
        safetyNotice: definition.safetyNotice,
        clinicalSafety: definition.clinicalSafety,
        publicRead: definition.publicRead,
        updatedById,
      },
      update: { enabled, updatedById },
    });
    updated.push(key);
  }

  return { updated, rejected };
}
