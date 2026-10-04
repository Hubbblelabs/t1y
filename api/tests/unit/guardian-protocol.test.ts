import { describe, expect, it } from "vitest";

import * as browser from "@/components/guardian/guardian-crypto-client";
import {
  PBKDF2_ITERATIONS,
  deriveSessionKeys,
  generateSalt,
  issueNonce,
  nonceIsValid,
  openJson,
  proofMatches,
  resolveAtRestKey,
  sealJson,
} from "@/lib/guardian-crypto";
import { guardianSubmissionSchema, startOfDayIn } from "@/lib/services/guardian-shares";

const appKey = resolveAtRestKey(undefined, "y".repeat(40));

describe("guardian protocol: browser page <-> server", () => {
  it("the page's proof is accepted by the server, and its ciphertext decrypts there", async () => {
    const salt = generateSalt();
    const nonce = issueNonce("s1", appKey);
    expect(nonceIsValid("s1", nonce, appKey)).toBe(true);

    const pageKeys = await browser.deriveSessionKeys("048213", salt, PBKDF2_ITERATIONS);
    const serverKeys = await deriveSessionKeys("048213", salt);

    expect(proofMatches(serverKeys, nonce, await browser.proofFor(pageKeys, nonce))).toBe(true);

    const sealed = await browser.sealJson({ guardianName: "Mrs Devi", glucose: { value: 142, slot: "PRE_LUNCH" } }, pageKeys, nonce);
    expect(openJson(sealed, serverKeys, nonce)).toEqual({ guardianName: "Mrs Devi", glucose: { value: 142, slot: "PRE_LUNCH" } });
  });

  it("the page decrypts what the server seals, and a wrong code cannot", async () => {
    const salt = generateSalt();
    const nonce = issueNonce("s1", appKey);
    const serverKeys = await deriveSessionKeys("111111", salt);
    const sealed = sealJson({ nextSlot: "PRE_LUNCH", insulin: true, carbs: false, exercise: false }, serverKeys, nonce);

    const right = await browser.deriveSessionKeys("111111", salt, PBKDF2_ITERATIONS);
    expect(await browser.openJson(sealed, right, nonce)).toMatchObject({ nextSlot: "PRE_LUNCH" });

    const wrong = await browser.deriveSessionKeys("222222", salt, PBKDF2_ITERATIONS);
    await expect(browser.openJson(sealed, wrong, nonce)).rejects.toBeDefined();
    expect(proofMatches(serverKeys, nonce, await browser.proofFor(wrong, nonce))).toBe(false);
  });
});

describe("guardian submission validation", () => {
  const base = { guardianName: "Mr Kumar" };

  it("needs a name and at least one reading", () => {
    expect(guardianSubmissionSchema.safeParse(base).success).toBe(false);
    expect(guardianSubmissionSchema.safeParse({ insulinUnits: 4 }).success).toBe(false);
    expect(guardianSubmissionSchema.safeParse({ ...base, insulinUnits: 4 }).success).toBe(true);
  });

  it("caps the food description at 200 characters", () => {
    const ok = { ...base, carbs: { grams: 30, food: "x".repeat(200) } };
    const tooLong = { ...base, carbs: { grams: 30, food: "x".repeat(201) } };
    expect(guardianSubmissionSchema.safeParse(ok).success).toBe(true);
    expect(guardianSubmissionSchema.safeParse(tooLong).success).toBe(false);
  });

  it("rejects implausible numbers", () => {
    expect(guardianSubmissionSchema.safeParse({ ...base, glucose: { value: 5, slot: "PRE_LUNCH" } }).success).toBe(false);
    expect(guardianSubmissionSchema.safeParse({ ...base, insulinUnits: 500 }).success).toBe(false);
    expect(guardianSubmissionSchema.safeParse({ ...base, exerciseMinutes: 1.5 }).success).toBe(false);
  });
});

describe("start of the child's day", () => {
  it("is local midnight in the child's timezone", () => {
    // 2026-10-02 20:00 UTC is already 2026-10-03 01:30 in India.
    const start = startOfDayIn("Asia/Kolkata", new Date("2026-10-02T20:00:00Z"));
    expect(start.toISOString()).toBe("2026-10-02T18:30:00.000Z");
  });

  it("falls back to UTC for an unknown zone", () => {
    expect(startOfDayIn("Not/AZone", new Date("2026-10-02T20:00:00Z")).toISOString()).toBe("2026-10-02T00:00:00.000Z");
  });
});
