import "server-only";

import { z } from "zod";

import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import {
  PBKDF2_ITERATIONS,
  decryptAtRest,
  deriveSessionKeys,
  encryptAtRest,
  generateCode,
  generateSalt,
  generateToken,
  hashToken,
  issueNonce,
  nonceIsValid,
  openJson,
  proofMatches,
  resolveAtRestKey,
  sealJson,
  type SessionKeys,
} from "@/lib/guardian-crypto";
import {
  GLUCOSE_SLOT_KEYS,
  glucoseContextForSlot,
  type GlucoseSlotKey,
  type GuardianCollectKey,
} from "@/lib/health-data-config";
import { isFeatureEnabled } from "@/lib/services/feature-flags";
import { touchParticipantActivity } from "@/lib/services/shared";

/**
 * Guardian links: a parent who is away from their child (at school, say) gives
 * a teacher or relative a one-time link. The guardian opens it, enters the
 * 6-digit code the parent shares separately, and records the readings still
 * due today. Submitting spends the link and tells the parent in the app.
 *
 * Wire protocol and crypto: lib/guardian-crypto.ts. The web page is
 * components/guardian/guardian-entry.tsx.
 */

export const MIN_EXPIRY_MINUTES = 15;
export const MAX_EXPIRY_MINUTES = 24 * 60;
const MAX_FAILED_ATTEMPTS = 5;

export const guardianSubmissionSchema = z
  .object({
    guardianName: z.string().trim().min(2, "Please enter your name.").max(80),
    glucose: z
      .object({
        value: z.number().finite().min(10).max(1000),
        slot: z.enum(GLUCOSE_SLOT_KEYS),
      })
      .optional(),
    insulinUnits: z.number().finite().min(0.1).max(300).optional(),
    carbs: z
      .object({
        grams: z.number().finite().min(0.1).max(500),
        food: z.string().trim().max(200, "Describe the food in 200 characters or fewer.").optional(),
      })
      .optional(),
    exerciseMinutes: z.number().int().min(1).max(1440).optional(),
  })
  .refine(
    (v) => v.glucose || v.insulinUnits !== undefined || v.carbs || v.exerciseMinutes !== undefined,
    { message: "Enter at least one reading before saving." },
  );

export type GuardianSubmission = z.infer<typeof guardianSubmissionSchema>;

/** What the guardian's page should ask for, decided on the server. */
export interface GuardianForm {
  /** The one glucose check still due today, or null when none is. */
  nextSlot: GlucoseSlotKey | null;
  insulin: boolean;
  carbs: boolean;
  exercise: boolean;
  /// The parent's note to the guardian, if they wrote one.
  purpose: string | null;
}

function atRestKey(): Buffer {
  return resolveAtRestKey(env.SHARE_ENCRYPTION_KEY, env.BETTER_AUTH_SECRET);
}

type ShareRow = NonNullable<Awaited<ReturnType<typeof findByToken>>>;

async function findByToken(token: string) {
  return prisma.guardianShare.findUnique({ where: { tokenHash: hashToken(token) } });
}

export type EffectiveStatus = "ACTIVE" | "USED" | "REVOKED" | "LOCKED" | "EXPIRED";

export function effectiveStatus(share: { status: string; expiresAt: Date }): EffectiveStatus {
  if (share.status === "ACTIVE" && share.expiresAt.getTime() <= Date.now()) return "EXPIRED";
  return share.status as EffectiveStatus;
}

// ---------------------------------------------------------------------------
// The parent's side
// ---------------------------------------------------------------------------

export async function createShare(
  userId: string,
  expiresInMinutes: number,
  options: { collect: GuardianCollectKey[]; purpose?: string },
) {
  const minutes = Math.min(MAX_EXPIRY_MINUTES, Math.max(MIN_EXPIRY_MINUTES, Math.round(expiresInMinutes)));
  const token = generateToken();
  const code = generateCode();

  // One live link at a time: a new one cancels any earlier unused one, so a
  // forgotten link can never be filled in after its replacement was sent.
  const [, share] = await prisma.$transaction([
    prisma.guardianShare.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "REVOKED" },
    }),
    prisma.guardianShare.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        salt: generateSalt(),
        codeEnc: encryptAtRest(code, atRestKey()),
        expiresAt: new Date(Date.now() + minutes * 60_000),
        collect: options.collect,
        purpose: options.purpose?.trim() || null,
      },
    }),
  ]);

  return {
    id: share.id,
    url: `${env.APP_URL.replace(/\/$/, "")}/g/${token}`,
    code,
    expiresAt: share.expiresAt,
  };
}

/** The parent's recent links. The code is included only while the link can still be used. */
export async function listShares(userId: string) {
  const rows = await prisma.guardianShare.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return rows.map((row) => {
    const status = effectiveStatus(row);
    return {
      id: row.id,
      status,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      guardianName: row.guardianName,
      collect: row.collect,
      purpose: row.purpose,
      code: status === "ACTIVE" ? decryptAtRest(row.codeEnc, atRestKey()) : null,
    };
  });
}

export async function revokeShare(userId: string, id: string): Promise<void> {
  const { count } = await prisma.guardianShare.updateMany({
    where: { id, userId, status: "ACTIVE" },
    data: { status: "REVOKED" },
  });
  if (count === 0) throw new NotFoundError("Active link");
}

// ---------------------------------------------------------------------------
// The guardian's side (unauthenticated — the link and code are the credential)
// ---------------------------------------------------------------------------

function assertUsable(share: ShareRow | null): asserts share is ShareRow {
  if (!share) throw new NotFoundError("This link");
  const status = effectiveStatus(share);
  if (status === "ACTIVE") return;
  const reason: Record<Exclude<EffectiveStatus, "ACTIVE">, string> = {
    USED: "This link has already been used.",
    REVOKED: "This link was cancelled by the parent.",
    LOCKED: "This link is locked after too many wrong codes. Ask the parent for a new one.",
    EXPIRED: "This link has expired. Ask the parent for a new one.",
  };
  throw new ConflictError(reason[status]);
}

/** What the page needs before it can ask for the code. Reveals nothing about the child. */
export async function getShareChallenge(token: string) {
  const share = await findByToken(token);
  assertUsable(share);
  return {
    expiresAt: share.expiresAt,
    salt: share.salt,
    iterations: PBKDF2_ITERATIONS,
    nonce: issueNonce(share.id, atRestKey()),
  };
}

/**
 * Checks the guardian's proof of the code. A wrong proof counts toward the
 * lockout. Returns the keys on success.
 */
async function authenticate(share: ShareRow, nonce: string, proof: string): Promise<SessionKeys> {
  const key = atRestKey();
  if (!nonceIsValid(share.id, nonce, key)) {
    throw new ConflictError("This page has been open too long. Please reload it.");
  }
  const keys = await deriveSessionKeys(decryptAtRest(share.codeEnc, key), share.salt);
  if (proofMatches(keys, nonce, proof)) return keys;

  const updated = await prisma.guardianShare.update({
    where: { id: share.id },
    data: { failedAttempts: { increment: 1 } },
    select: { failedAttempts: true },
  });
  if (updated.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.guardianShare.update({ where: { id: share.id }, data: { status: "LOCKED" } });
    throw new ForbiddenError("Too many wrong codes. This link is now locked — ask the parent for a new one.");
  }
  throw new ForbiddenError(
    `That code is not right. ${MAX_FAILED_ATTEMPTS - updated.failedAttempts} attempts left.`,
  );
}

/** Midnight at the start of today in the child's timezone. */
export function startOfDayIn(timeZone: string, now = new Date()): Date {
  let local: Date;
  try {
    local = new Date(now.toLocaleString("en-US", { timeZone }));
  } catch {
    return startOfDayIn("UTC", now);
  }
  const offset = local.getTime() - now.getTime();
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}

/**
 * What to ask for: whatever the child is enrolled for, narrowed to what the
 * parent chose to collect through this link.
 */
export async function buildGuardianForm(
  userId: string,
  share: { collect: string[]; purpose: string | null },
): Promise<GuardianForm> {
  const [user, healthOn, carbFlagOn] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
        profile: {
          select: { enabledFeatures: true, glucoseSlots: true, exerciseEnabled: true },
        },
      },
    }),
    isFeatureEnabled("health_logging_enabled"),
    isFeatureEnabled("carb_logging_enabled"),
  ]);
  const profile = user?.profile;
  if (!user || !profile || !healthOn) {
    return { nextSlot: null, insulin: false, carbs: false, exercise: false, purpose: share.purpose };
  }

  const wants = (key: GuardianCollectKey) => share.collect.includes(key);

  let nextSlot: GlucoseSlotKey | null = null;
  if (wants("GLUCOSE") && profile.enabledFeatures.includes("GLUCOSE_LOGGING")) {
    const done = await prisma.glucoseReading.findMany({
      where: { userId, slot: { not: null }, measuredAt: { gte: startOfDayIn(user.timezone) } },
      select: { slot: true },
    });
    const doneSlots = new Set(done.map((r) => r.slot));
    nextSlot = GLUCOSE_SLOT_KEYS.find((s) => profile.glucoseSlots.includes(s) && !doneSlots.has(s)) ?? null;
  }

  return {
    nextSlot,
    insulin: wants("INSULIN") && profile.enabledFeatures.includes("INSULIN_LOGGING"),
    carbs: wants("CARBS") && profile.enabledFeatures.includes("CARB_LOGGING") && carbFlagOn,
    exercise: wants("EXERCISE") && profile.exerciseEnabled,
    purpose: share.purpose,
  };
}

/** Verifies the code and returns what to ask for, encrypted under the session keys. */
export async function openShare(token: string, nonce: string, proof: string) {
  const share = await findByToken(token);
  assertUsable(share);
  const keys = await authenticate(share, nonce, proof);
  return sealJson(await buildGuardianForm(share.userId, share), keys, nonce);
}

/**
 * Verifies the code, decrypts and validates the guardian's entries, records
 * them against the child (marked with the guardian's name), spends the link
 * and notifies the parent — all or nothing.
 */
export async function submitShare(
  token: string,
  input: { nonce: string; proof: string; iv: string; ct: string },
): Promise<void> {
  const share = await findByToken(token);
  assertUsable(share);
  const keys = await authenticate(share, input.nonce, input.proof);

  const opened = openJson({ iv: input.iv, ct: input.ct }, keys, input.nonce);
  const parsed = guardianSubmissionSchema.safeParse(opened);
  if (!parsed.success) {
    throw new ConflictError(parsed.error.issues[0]?.message ?? "Those entries could not be read.");
  }
  const entry = parsed.data;

  const form = await buildGuardianForm(share.userId, share);
  if (entry.glucose && entry.glucose.slot !== form.nextSlot) {
    throw new ConflictError("That glucose check is not the one due now. Reload the page.");
  }
  if (entry.insulinUnits !== undefined && !form.insulin) throw new ConflictError("Insulin is not turned on for this child.");
  if (entry.carbs && !form.carbs) throw new ConflictError("Carbohydrates are not turned on for this child.");
  if (entry.exerciseMinutes !== undefined && !form.exercise) throw new ConflictError("Exercise is not turned on for this child.");

  const now = new Date();
  const enteredBy = entry.guardianName;
  const userId = share.userId;

  await prisma.$transaction(async (tx) => {
    // Spend the link first, conditionally: of two simultaneous submissions only one wins.
    const { count } = await tx.guardianShare.updateMany({
      where: { id: share.id, status: "ACTIVE", expiresAt: { gt: now } },
      data: { status: "USED", usedAt: now, guardianName: enteredBy },
    });
    if (count !== 1) throw new ConflictError("This link has already been used or has expired.");

    if (entry.glucose) {
      await tx.glucoseReading.create({
        data: {
          userId,
          value: entry.glucose.value,
          unit: "MG_DL",
          slot: entry.glucose.slot,
          context: glucoseContextForSlot(entry.glucose.slot),
          measuredAt: now,
          enteredBy,
        },
      });
    }
    if (entry.insulinUnits !== undefined) {
      await tx.insulinLog.create({
        data: {
          userId,
          insulinName: "Insulin",
          insulinType: "OTHER",
          doseUnits: entry.insulinUnits,
          administeredAt: now,
          enteredBy,
        },
      });
    }
    if (entry.carbs) {
      await tx.meal.create({
        data: {
          userId,
          name: entry.carbs.food || undefined,
          mealType: "OTHER",
          consumedAt: now,
          totalCarbsGrams: entry.carbs.grams,
          enteredBy,
        },
      });
    }
    if (entry.exerciseMinutes !== undefined) {
      await tx.exerciseLog.create({
        data: {
          userId,
          activityName: "Exercise",
          category: "OTHER",
          durationMinutes: entry.exerciseMinutes,
          performedAt: now,
          enteredBy,
        },
      });
    }

    await tx.notification.create({
      data: {
        userId,
        type: "GENERAL",
        title: "Readings entered through your link",
        // No health values here — previews appear on lock screens.
        body: `${enteredBy} recorded your child's readings. The link has now expired.`,
        data: { kind: "guardian_share", shareId: share.id },
      },
    });
  });

  await touchParticipantActivity(userId);
}
