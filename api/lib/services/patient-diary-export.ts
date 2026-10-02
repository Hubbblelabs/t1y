import "server-only";

import ExcelJS from "exceljs";

import type { Principal } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { participantScopeFilter } from "@/lib/permissions/policies";
import {
  DIARY_SLOT_COLUMNS,
  ageInYears,
  average,
  bmi,
  dayKey,
  diarySlotFor,
  toMgDl,
  type DiarySlot,
} from "@/lib/patient-diary";

/**
 * The patient-diary workbook: the paper diary's contents, for every child, and
 * nothing else.
 *
 *  1. "Patient details" — one row per child: name, sex, date of birth, age,
 *     hospital numbers, address, telephone, height, weight, BMI, treating
 *     doctor, educator.
 *  2. "Investigations" — one row per child per day: fasting sugar, sugar 2 h
 *     after meals, HbA1c. These are the only investigations the app collects;
 *     cholesterol, BP, X-ray and the rest are not gathered, so they are not in
 *     the file.
 *  3. "Daily log" — one row per child per day, laid out like the diary's
 *     day-by-day table: the six sugar readings, insulin dose, food, exercise.
 *
 * This is **identifiable** data (names, dates of birth, addresses) — unlike the
 * research exports, which are pseudonymous. The route that serves it is
 * audited, and the audit entry carries counts only.
 */

type Fields = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dateOnly(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

const SEX_LABEL: Record<string, string> = {
  FEMALE: "F",
  MALE: "M",
  INTERSEX: "Intersex",
  PREFER_NOT_TO_SAY: "",
  UNSPECIFIED: "",
};

interface DayRow {
  userId: string;
  code: string;
  day: string;
  slots: Partial<Record<DiarySlot, { at: number; value: number }>>;
  fasting: number[];
  postMeal: number[];
  insulin: number;
  carbsGrams: number;
  foods: string[];
  exerciseMinutes: number;
  hba1c: number | null;
}

export interface DiaryExport {
  buffer: Buffer;
  children: number;
  dayRows: number;
}

export async function buildPatientDiaryWorkbook(principal: Principal): Promise<DiaryExport> {
  const users = await prisma.user.findMany({
    where: { ...(await participantScopeFilter(principal)), role: "PATIENT", deletedAt: null },
    select: {
      id: true,
      timezone: true,
      profile: {
        select: {
          participantCode: true,
          name: true,
          sex: true,
          dateOfBirth: true,
          phone: true,
          city: true,
          country: true,
          heightCm: true,
          baselineWeightKg: true,
          primaryClinician: true,
          customFieldValues: true,
        },
      },
    },
  });
  const children = users
    .filter((u) => u.profile)
    .sort((a, b) => a.profile!.participantCode.localeCompare(b.profile!.participantCode));
  const ids = children.map((c) => c.id);
  const tz = new Map(children.map((c) => [c.id, c.timezone] as const));
  const code = new Map(children.map((c) => [c.id, c.profile!.participantCode] as const));

  const [readings, insulin, meals, exercise, hba1c] = await Promise.all([
    prisma.glucoseReading.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, value: true, unit: true, slot: true, context: true, measuredAt: true },
    }),
    prisma.insulinLog.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, doseUnits: true, administeredAt: true },
    }),
    prisma.meal.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, totalCarbsGrams: true, name: true, consumedAt: true },
    }),
    prisma.exerciseLog.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, durationMinutes: true, performedAt: true },
    }),
    prisma.hbA1cRecord.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, valuePercent: true, measuredAt: true },
    }),
  ]);

  const days = new Map<string, DayRow>();
  const row = (userId: string, at: Date): DayRow => {
    const day = dayKey(at, tz.get(userId) ?? "UTC");
    const key = `${userId}|${day}`;
    let r = days.get(key);
    if (!r) {
      r = {
        userId,
        code: code.get(userId) ?? "",
        day,
        slots: {},
        fasting: [],
        postMeal: [],
        insulin: 0,
        carbsGrams: 0,
        foods: [],
        exerciseMinutes: 0,
        hba1c: null,
      };
      days.set(key, r);
    }
    return r;
  };

  for (const reading of readings) {
    const slot = diarySlotFor(reading);
    if (!slot) continue;
    const value = toMgDl(reading.value, reading.unit);
    const r = row(reading.userId, reading.measuredAt);
    const at = reading.measuredAt.getTime();
    // The diary has one box per slot per day: the latest reading fills it.
    if (!r.slots[slot] || r.slots[slot]!.at < at) r.slots[slot] = { at, value };
    if (slot === "PRE_BREAKFAST") r.fasting.push(value);
    if (slot.startsWith("POST_")) r.postMeal.push(value);
  }
  for (const dose of insulin) row(dose.userId, dose.administeredAt).insulin += dose.doseUnits;
  for (const meal of meals) {
    const r = row(meal.userId, meal.consumedAt);
    r.carbsGrams += meal.totalCarbsGrams ?? 0;
    if (meal.name) r.foods.push(meal.name);
  }
  for (const session of exercise) row(session.userId, session.performedAt).exerciseMinutes += session.durationMinutes;
  for (const record of hba1c) row(record.userId, record.measuredAt).hba1c = record.valuePercent;

  const dayRows = [...days.values()].sort((a, b) =>
    a.code === b.code ? a.day.localeCompare(b.day) : a.code.localeCompare(b.code),
  );

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const style = (sheet: ExcelJS.Worksheet) => {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.alignment = { vertical: "middle", wrapText: true };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D47A1" } };
    header.height = 32;
  };

  // 1. Patient details -----------------------------------------------------
  const details = workbook.addWorksheet("Patient details");
  details.columns = [
    { header: "Participant code", key: "code", width: 16 },
    { header: "Name", key: "name", width: 26 },
    { header: "Sex (M/F)", key: "sex", width: 10 },
    { header: "Date of birth", key: "dob", width: 14 },
    { header: "Age (years)", key: "age", width: 11 },
    { header: "Hospital No.", key: "hospital", width: 16 },
    { header: "Other hospital No.", key: "otherHospital", width: 18 },
    { header: "Address", key: "address", width: 34 },
    { header: "Telephone", key: "phone", width: 16 },
    { header: "Height (cm)", key: "height", width: 12 },
    { header: "Weight (kg)", key: "weight", width: 12 },
    { header: "Body mass index", key: "bmi", width: 14 },
    { header: "Treating doctor's name", key: "doctor", width: 24 },
    { header: "Educator's name", key: "educator", width: 22 },
  ];
  for (const child of children) {
    const p = child.profile!;
    const custom = (p.customFieldValues ?? {}) as Fields;
    details.addRow({
      code: p.participantCode,
      name: p.name,
      sex: SEX_LABEL[p.sex] ?? "",
      dob: dateOnly(p.dateOfBirth),
      age: ageInYears(p.dateOfBirth) ?? "",
      hospital: text(custom.hospitalNumber),
      otherHospital: text(custom.otherHospitalNumber),
      address: text(custom.address) || [p.city, p.country].filter(Boolean).join(", "),
      phone: p.phone ?? "",
      height: p.heightCm ?? "",
      weight: p.baselineWeightKg ?? "",
      bmi: bmi(p.heightCm, p.baselineWeightKg) ?? "",
      doctor: p.primaryClinician ?? "",
      educator: text(custom.educatorName),
    });
  }
  style(details);

  // 2. Investigations ------------------------------------------------------
  const investigations = workbook.addWorksheet("Investigations");
  investigations.columns = [
    { header: "Participant code", key: "code", width: 16 },
    { header: "Date", key: "day", width: 12 },
    { header: "Blood sugar – fasting (mg/dL)", key: "fasting", width: 22 },
    { header: "Blood sugar – 2 hours after meals (mg/dL)", key: "post", width: 26 },
    { header: "HbA1c (%)", key: "hba1c", width: 12 },
  ];
  for (const r of dayRows) {
    const fasting = average(r.fasting);
    const post = average(r.postMeal);
    if (fasting === null && post === null && r.hba1c === null) continue;
    investigations.addRow({ code: r.code, day: r.day, fasting: fasting ?? "", post: post ?? "", hba1c: r.hba1c ?? "" });
  }
  style(investigations);

  // 3. Daily log -----------------------------------------------------------
  const log = workbook.addWorksheet("Daily log");
  log.columns = [
    { header: "Participant code", key: "code", width: 16 },
    { header: "Date", key: "day", width: 12 },
    ...DIARY_SLOT_COLUMNS.map((c) => ({ header: c.header, key: c.slot, width: 17 })),
    { header: "Insulin dose (units)", key: "insulin", width: 16 },
    { header: "Food", key: "food", width: 36 },
    { header: "Exercise (minutes)", key: "exercise", width: 16 },
  ];
  let logRows = 0;
  for (const r of dayRows) {
    const anySugar = DIARY_SLOT_COLUMNS.some((c) => r.slots[c.slot]);
    if (!anySugar && !r.insulin && !r.carbsGrams && !r.foods.length && !r.exerciseMinutes) continue;
    const food = [
      r.carbsGrams ? `${Math.round(r.carbsGrams * 10) / 10} g carbs` : "",
      ...r.foods,
    ]
      .filter(Boolean)
      .join("; ");
    log.addRow({
      code: r.code,
      day: r.day,
      ...Object.fromEntries(DIARY_SLOT_COLUMNS.map((c) => [c.slot, r.slots[c.slot] ? Math.round(r.slots[c.slot]!.value * 10) / 10 : ""])),
      insulin: r.insulin ? Math.round(r.insulin * 10) / 10 : "",
      food,
      exercise: r.exerciseMinutes || "",
    });
    logRows += 1;
  }
  style(log);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, children: children.length, dayRows: logRows };
}
