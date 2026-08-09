import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Platform settings.
 *
 * Values are stored as JSON against a stable key so new settings do not
 * require a migration. Defaults live here, which means a missing row behaves
 * predictably rather than as `undefined`.
 *
 * Note what is *not* here: no clinical thresholds. Those are deliberately a
 * separate, provenance-carrying model rather than a loose settings blob.
 */

export const SETTING_DEFAULTS = {
  "platform.name": "Digital Diabetes Management Platform",
  "platform.supportEmail": "",
  "platform.defaultTimezone": "UTC",
  "platform.defaultGlucoseUnit": "MG_DL",

  "participants.autoGenerateCodes": true,
  "participants.inactivityDays": 30,

  "reports.defaultRange": "30d",
  "reports.adherenceWindowDays": 30,

  "notifications.quietHoursStart": "21:00",
  "notifications.quietHoursEnd": "07:00",
  "notifications.allowHealthValuesInBody": false,

  "exports.maxRows": 50000,
  "exports.retentionDays": 7,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export type SettingsMap = {
  [K in SettingKey]: (typeof SETTING_DEFAULTS)[K];
};

/** All settings, with stored values overlaid on the defaults. */
export async function getSettings(): Promise<SettingsMap> {
  const rows = await prisma.systemSetting.findMany({
    select: { key: true, value: true },
  });

  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const result = { ...SETTING_DEFAULTS } as Record<string, unknown>;

  for (const key of Object.keys(SETTING_DEFAULTS)) {
    if (stored.has(key)) result[key] = stored.get(key);
  }

  return result as SettingsMap;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsMap[K]> {
  const row = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  return (row?.value ?? SETTING_DEFAULTS[key]) as SettingsMap[K];
}

/**
 * Writes a batch of settings. Unknown keys are rejected rather than stored, so
 * the settings table cannot accumulate orphaned values.
 */
export async function updateSettings(
  updates: Partial<Record<SettingKey, unknown>>,
  updatedById: string,
): Promise<{ updated: SettingKey[]; rejected: string[] }> {
  const updated: SettingKey[] = [];
  const rejected: string[] = [];

  const operations: Prisma.PrismaPromise<unknown>[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (!(key in SETTING_DEFAULTS)) {
      rejected.push(key);
      continue;
    }

    operations.push(
      prisma.systemSetting.upsert({
        where: { key },
        create: {
          key,
          value: value as Prisma.InputJsonValue,
          category: key.split(".")[0] ?? "general",
          updatedById,
        },
        update: { value: value as Prisma.InputJsonValue, updatedById },
      }),
    );
    updated.push(key as SettingKey);
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  return { updated, rejected };
}
