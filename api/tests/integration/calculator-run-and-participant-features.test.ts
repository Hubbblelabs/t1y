import { afterAll, describe, expect, it } from "vitest";

import { ForbiddenError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { createCalculator, setCalculatorActive } from "@/lib/services/calculators";
import { runCalculatorForParticipant, searchParticipantsForCalculator } from "@/lib/services/calculator-run";
import {
  GLUCOSE_REMINDER_GAP_HOURS,
  listGlucoseLoggingStatus,
  sendGlucoseReminders,
} from "@/lib/services/glucose-reminders";
import { assertFeatureEnabled } from "@/lib/services/participant-features";
import { createParticipant } from "@/lib/services/participants";

/**
 * The admin-only calculator workbench, per-participant feature eligibility,
 * and the glucose-logging reminder — against the development database.
 *
 * Calculators are no longer shown to a parent at all (see the removed
 * /api/calculators routes and the Flutter app's Calculators screen): the
 * property that matters here is that only the admin workbench can ever
 * produce a number from one, for one named child, using that child's own
 * records or a value staff typed in instead.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 npm test
 */

const createdUserIds: string[] = [];
const createdCalculatorIds: string[] = [];

afterAll(async () => {
  if (createdCalculatorIds.length > 0) {
    await prisma.calculator.deleteMany({ where: { id: { in: createdCalculatorIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

async function anAdminId(): Promise<string> {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No admin in the development database. Run `npm run db:seed`.");
  return admin.id;
}

async function aParticipant(enabledFeatures?: string[]) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const participant = await createParticipant({
    email: `calc-run-${stamp}@example.test`,
    name: "Test Child",
    enabledFeatures: enabledFeatures as never,
  });
  createdUserIds.push(participant.id);
  // listGlucoseLoggingStatus only looks at ACTIVE participants — createParticipant
  // deliberately leaves a new record PENDING (see lib/services/participants.ts).
  await prisma.user.update({ where: { id: participant.id }, data: { status: "ACTIVE" } });
  return participant.id;
}

async function aRatioCalculator() {
  const calculator = await createCalculator(await anAdminId(), {
    nameEn: `Test ratios ${Date.now()}`,
    inputs: [
      {
        key: "tdd",
        labelEn: "Total daily dose",
        unit: "units",
        min: 1,
        source: "DATA",
        sourceKey: "insulin_total_daily_dose",
      },
    ],
    outputs: [
      { key: "ic", labelEn: "IC ratio", unit: "g per unit", expression: "500 / tdd" },
    ],
  });
  createdCalculatorIds.push(calculator.id);
  return calculator;
}

describe("running a calculator for a participant", () => {
  it("fills a DATA input from that child's own records", async () => {
    const userId = await aParticipant();
    const calculator = await aRatioCalculator();

    await prisma.insulinLog.createMany({
      data: [1, 2, 3, 4].map((daysAgo) => ({
        userId,
        insulinName: "Test",
        insulinType: "RAPID_ACTING",
        doseUnits: 25,
        administeredAt: new Date(Date.now() - daysAgo * 86_400_000),
      })),
    });

    const result = await runCalculatorForParticipant({ calculatorId: calculator.id, userId });

    expect(result.error).toBeNull();
    expect(result.inputs[0].source).toBe("DATA");
    expect(result.inputs[0].value).toBe(25);
    expect(result.results.find((r) => r.key === "ic")?.value).toBe(20); // 500 / 25
  });

  it("lets staff override a value instead of using the record", async () => {
    const userId = await aParticipant();
    const calculator = await aRatioCalculator();

    const result = await runCalculatorForParticipant({
      calculatorId: calculator.id,
      userId,
      overrides: { tdd: 50 },
    });

    expect(result.error).toBeNull();
    expect(result.inputs[0].source).toBe("OVERRIDE");
    expect(result.results.find((r) => r.key === "ic")?.value).toBe(10); // 500 / 50
  });

  it("asOf works out what the calculator would have shown at an earlier moment", async () => {
    const userId = await aParticipant();
    const calculator = await aRatioCalculator();

    // A week of 10-unit days, then a change to 40-unit days starting now.
    const rows = [];
    for (let daysAgo = 14; daysAgo >= 8; daysAgo--) {
      rows.push({
        userId,
        insulinName: "Test",
        insulinType: "RAPID_ACTING" as const,
        doseUnits: 10,
        administeredAt: new Date(Date.now() - daysAgo * 86_400_000),
      });
    }
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      rows.push({
        userId,
        insulinName: "Test",
        insulinType: "RAPID_ACTING" as const,
        doseUnits: 40,
        administeredAt: new Date(Date.now() - daysAgo * 86_400_000),
      });
    }
    await prisma.insulinLog.createMany({ data: rows });

    const today = await runCalculatorForParticipant({ calculatorId: calculator.id, userId });
    expect(today.inputs[0].value).toBe(40);

    const aWeekAgo = await runCalculatorForParticipant({
      calculatorId: calculator.id,
      userId,
      asOf: new Date(Date.now() - 9 * 86_400_000),
    });
    expect(aWeekAgo.inputs[0].value).toBe(10);
  });

  it("reports a missing value plainly rather than calculating with nothing", async () => {
    const userId = await aParticipant();
    const calculator = await aRatioCalculator();

    const result = await runCalculatorForParticipant({ calculatorId: calculator.id, userId });

    expect(result.results).toHaveLength(0);
    expect(result.error).toMatch(/Total daily dose/);
  });

  it("does not run a hidden calculator any differently — hidden only means the app never showed it", async () => {
    const userId = await aParticipant();
    const calculator = await aRatioCalculator();
    await setCalculatorActive(calculator.id, false);

    const result = await runCalculatorForParticipant({
      calculatorId: calculator.id,
      userId,
      overrides: { tdd: 25 },
    });
    expect(result.error).toBeNull();
  });

  it("the participant picker finds by name, email and participant code", async () => {
    const userId = await aParticipant();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, profile: { select: { participantCode: true } } },
    });

    const byCode = await searchParticipantsForCalculator(user.profile!.participantCode);
    expect(byCode.some((row) => row.id === userId)).toBe(true);
  });
});

describe("a participant's feature eligibility", () => {
  it("defaults to every feature when none is chosen at creation", async () => {
    const userId = await aParticipant();
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { userId },
      select: { enabledFeatures: true },
    });
    expect(profile.enabledFeatures).toEqual(
      expect.arrayContaining(["GLUCOSE_LOGGING", "INSULIN_LOGGING", "CARB_LOGGING"]),
    );
  });

  it("is limited to what was chosen when features are given explicitly", async () => {
    const userId = await aParticipant(["GLUCOSE_LOGGING"]);
    await expect(assertFeatureEnabled(userId, "GLUCOSE_LOGGING")).resolves.toBeUndefined();
    await expect(assertFeatureEnabled(userId, "INSULIN_LOGGING")).rejects.toThrow(ForbiddenError);
  });

  it("can be changed later from the participant's record", async () => {
    const userId = await aParticipant(["GLUCOSE_LOGGING"]);
    await prisma.profile.update({
      where: { userId },
      data: { enabledFeatures: ["GLUCOSE_LOGGING", "CARB_LOGGING"] },
    });
    await expect(assertFeatureEnabled(userId, "CARB_LOGGING")).resolves.toBeUndefined();
  });
});

describe("the glucose logging reminder", () => {
  it("flags a participant with no reading at all as overdue", async () => {
    const userId = await aParticipant();
    const statuses = await listGlucoseLoggingStatus();
    const mine = statuses.find((status) => status.userId === userId);
    expect(mine?.overdue).toBe(true);
    expect(mine?.lastReadingAt).toBeNull();
  });

  it(`does not flag a reading from within the last ${GLUCOSE_REMINDER_GAP_HOURS} hours`, async () => {
    const userId = await aParticipant();
    await prisma.glucoseReading.create({
      data: { userId, value: 110, unit: "MG_DL", context: "RANDOM", measuredAt: new Date() },
    });
    const statuses = await listGlucoseLoggingStatus();
    expect(statuses.find((status) => status.userId === userId)?.overdue).toBe(false);
  });

  it("sends exactly one reminder, then does not repeat it within the window", async () => {
    const userId = await aParticipant();
    const first = await sendGlucoseReminders();
    expect(first.sent).toBeGreaterThanOrEqual(1);

    const notified = await prisma.notification.findMany({
      where: { userId, type: "GLUCOSE_REMINDER" },
    });
    expect(notified).toHaveLength(1);

    await sendGlucoseReminders();
    const stillNotified = await prisma.notification.findMany({
      where: { userId, type: "GLUCOSE_REMINDER" },
    });
    expect(stillNotified).toHaveLength(1);
  });

  it("never reminds a participant who is not eligible for glucose logging", async () => {
    const userId = await aParticipant(["INSULIN_LOGGING"]);
    const statuses = await listGlucoseLoggingStatus();
    expect(statuses.some((status) => status.userId === userId)).toBe(false);
  });
});
