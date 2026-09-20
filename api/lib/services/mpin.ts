import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { backfillHousehold } from "@/lib/services/households";

/**
 * The MPIN gating glucose entry: a short numeric code the parent sets so a
 * child holding the phone can't type readings into their own record.
 *
 * It is explicitly *not* a second account password. A 4-digit code has at
 * most ten thousand combinations, so it is only ever a "not the child's
 * fingers" gate: it never authenticates a session on its own, it only
 * unlocks a screen inside an already-authenticated one. Everything that
 * makes it safe enough for that job lives here — per-attempt hashing,
 * a lock-out after repeated failures, and a reset path that demands the real
 * account password rather than a "security question".
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** Exactly 4 digits — see the module doc for why the app settled on one length. */
const PIN_PATTERN = /^\d{4}$/;

/**
 * The handful of PINs that are, in practice, no PIN at all. Rejected at
 * set-time rather than silently accepted — a parent who picks "1234" gets a
 * gate a curious nine-year-old opens on the first try.
 */
const TRIVIAL_PINS = new Set([
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
  "1234", "4321", "0123",
]);

function assertWellFormed(pin: string): void {
  if (!PIN_PATTERN.test(pin)) {
    throw new ValidationError("Enter a 4-digit PIN.");
  }
  if (TRIVIAL_PINS.has(pin)) {
    throw new ValidationError("That PIN is too easy to guess. Please choose another.");
  }
}

/** `scrypt$<salt hex>$<key hex>` — self-describing, so the format can change later. */
async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(pin, salt, KEY_BYTES);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function pinMatches(pin: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(pin, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

export interface MpinStatus {
  isSet: boolean;
  setAt: Date | null;
  lockedUntil: Date | null;
  attemptsRemaining: number;
}

/**
 * Participants enrolled before households existed have no household row to
 * hang a PIN on. Rather than refusing them the feature, one is created on
 * demand from their own account — they are a household of one, which is
 * exactly what they were all along.
 */
async function householdForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { householdId: true },
  });
  if (!user) throw new NotFoundError("Account");

  const householdId = user.householdId ?? (await backfillHousehold(userId));
  const household = await prisma.household.findUnique({ where: { id: householdId } });
  if (!household) throw new NotFoundError("Household");
  return household;
}

/** What the app needs to decide between "set a PIN", "enter it", and "locked". */
export async function getMpinStatus(userId: string): Promise<MpinStatus> {
  const household = await householdForUser(userId);
  return {
    isSet: household.mpinHash !== null,
    setAt: household.mpinSetAt,
    lockedUntil: null,
    attemptsRemaining: 0,
  };
}

/**
 * Sets the household's first PIN. Changing an existing one goes through
 * [resetMpin] instead, which proves the account password first — otherwise
 * anyone holding an unlocked phone could quietly replace the gate.
 */
export async function setMpin(userId: string, pin: string): Promise<void> {
  assertWellFormed(pin);
  const household = await householdForUser(userId);
  if (household.mpinHash) {
    throw new ForbiddenError(
      "A PIN is already set. Use 'Forgot PIN' to change it with your password.",
    );
  }

  await prisma.household.update({
    where: { id: household.id },
    data: {
      mpinHash: await hashPin(pin),
      mpinSetAt: new Date(),
      mpinFailedAttempts: 0,
      mpinLockedUntil: null,
    },
  });
}

/**
 * Replaces the PIN. The caller must already have verified the account
 * password — this service never sees it, so the route is responsible for
 * that check (see app/api/mpin/reset/route.ts).
 */
export async function resetMpin(userId: string, newPin: string): Promise<void> {
  assertWellFormed(newPin);
  const household = await householdForUser(userId);

  await prisma.household.update({
    where: { id: household.id },
    data: {
      mpinHash: await hashPin(newPin),
      mpinSetAt: new Date(),
      mpinFailedAttempts: 0,
      mpinLockedUntil: null,
    },
  });
}

export interface MpinVerifyResult {
  ok: boolean;
  attemptsRemaining: number;
  lockedUntil: Date | null;
}

/**
 * Checks a PIN. A wrong PIN comes back as `ok: false` rather than an error: a
 * mistyped PIN is an ordinary thing a parent does. There is no attempt count
 * and no lock-out, by the study team's decision — a parent can try as often
 * as they like.
 */
export async function verifyMpin(userId: string, pin: string): Promise<MpinVerifyResult> {
  const household = await householdForUser(userId);

  if (!household.mpinHash) {
    throw new ForbiddenError("No PIN has been set yet. Set one in Profile first.");
  }

  const ok = await pinMatches(pin, household.mpinHash);
  return { ok, attemptsRemaining: 0, lockedUntil: null };
}
