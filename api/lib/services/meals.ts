import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { MealType } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { round, touchParticipantActivity, TRUNC_UNIT, type TrendInterval } from "@/lib/services/shared";

/**
 * Nutrition records.
 *
 * Carbohydrate and calorie figures are participant-reported unless a meal
 * carries a `nutritionSource` naming a validated food database. The API
 * surfaces that provenance so consumers can present the numbers honestly
 * rather than implying laboratory precision.
 */

const MEAL_SELECT = {
  id: true,
  name: true,
  mealType: true,
  consumedAt: true,
  totalCarbsGrams: true,
  totalCalories: true,
  totalProteinGrams: true,
  totalFatGrams: true,
  totalFiberGrams: true,
  nutritionSource: true,
  photoUrl: true,
  notes: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      name: true,
      quantity: true,
      unit: true,
      carbsGrams: true,
      calories: true,
      proteinGrams: true,
      fatGrams: true,
      fiberGrams: true,
      referenceCode: true,
    },
  },
} satisfies Prisma.MealSelect;

export interface MealItemInput {
  name: string;
  quantity: number;
  unit: string;
  carbsGrams?: number;
  calories?: number;
  proteinGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  referenceCode?: string;
}

export interface CreateMealInput {
  name?: string;
  mealType: MealType;
  consumedAt: Date;
  totalCarbsGrams?: number;
  totalCalories?: number;
  totalProteinGrams?: number;
  totalFatGrams?: number;
  totalFiberGrams?: number;
  nutritionSource?: string;
  photoUrl?: string;
  notes?: string;
  items: MealItemInput[];
}

export async function listMeals(params: {
  userId: string;
  from: Date;
  to: Date;
  mealType?: MealType;
  sortOrder: "asc" | "desc";
  skip: number;
  take: number;
}) {
  const where: Prisma.MealWhereInput = {
    userId: params.userId,
    consumedAt: { gte: params.from, lte: params.to },
    ...(params.mealType ? { mealType: params.mealType } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.meal.findMany({
      where,
      select: MEAL_SELECT,
      orderBy: { consumedAt: params.sortOrder },
      skip: params.skip,
      take: params.take,
    }),
    prisma.meal.count({ where }),
  ]);

  return { items, total };
}

export async function getMeal(id: string) {
  const meal = await prisma.meal.findUnique({
    where: { id },
    select: { ...MEAL_SELECT, userId: true },
  });
  if (!meal) throw new NotFoundError("Meal");
  return meal;
}

/**
 * Totals default to the sum of the meal's items when not supplied explicitly.
 * A total the participant entered by hand always wins over a derived one.
 */
function deriveTotals(input: CreateMealInput) {
  const sum = (pick: (item: MealItemInput) => number | undefined) => {
    const values = input.items.map(pick).filter((value): value is number => value !== undefined);
    return values.length > 0 ? round(values.reduce((a, b) => a + b, 0), 1) : null;
  };

  return {
    totalCarbsGrams: input.totalCarbsGrams ?? sum((item) => item.carbsGrams),
    totalCalories: input.totalCalories ?? sum((item) => item.calories),
    totalProteinGrams: input.totalProteinGrams ?? sum((item) => item.proteinGrams),
    totalFatGrams: input.totalFatGrams ?? sum((item) => item.fatGrams),
    totalFiberGrams: input.totalFiberGrams ?? sum((item) => item.fiberGrams),
  };
}

export async function createMeal(userId: string, input: CreateMealInput) {
  const totals = deriveTotals(input);

  const meal = await prisma.meal.create({
    data: {
      userId,
      name: input.name,
      mealType: input.mealType,
      consumedAt: input.consumedAt,
      nutritionSource: input.nutritionSource,
      photoUrl: input.photoUrl,
      notes: input.notes,
      ...totals,
      items: { create: input.items },
    },
    select: MEAL_SELECT,
  });

  await touchParticipantActivity(userId);
  return meal;
}

export async function updateMeal(id: string, input: Partial<CreateMealInput>) {
  const totals = input.items ? deriveTotals(input as CreateMealInput) : {};

  return prisma.$transaction(async (tx) => {
    if (input.items) {
      // Items are replaced wholesale — a meal's composition is edited as a unit.
      await tx.mealItem.deleteMany({ where: { mealId: id } });
    }

    return tx.meal.update({
      where: { id },
      data: {
        name: input.name,
        mealType: input.mealType,
        consumedAt: input.consumedAt,
        nutritionSource: input.nutritionSource,
        photoUrl: input.photoUrl,
        notes: input.notes,
        ...totals,
        ...(input.items ? { items: { create: input.items } } : {}),
      },
      select: MEAL_SELECT,
    });
  });
}

export async function deleteMeal(id: string): Promise<void> {
  await prisma.meal.delete({ where: { id } });
}

export interface NutritionSummary {
  mealCount: number;
  daysWithMeals: number;
  periodDays: number;
  mealsPerDay: number | null;
  /** Null when no meal in the period recorded carbohydrates. */
  totalCarbsGrams: number | null;
  averageCarbsPerMeal: number | null;
  averageCarbsPerDay: number | null;
  totalCalories: number | null;
  averageCaloriesPerDay: number | null;
  /** Share of meals whose values came from a named nutrition database. */
  mealsWithNutritionSource: number;
  byMealType: Array<{ mealType: MealType; count: number; averageCarbsGrams: number | null }>;
}

export async function getNutritionSummary(params: {
  userId: string;
  from: Date;
  to: Date;
}): Promise<NutritionSummary> {
  const where: Prisma.MealWhereInput = {
    userId: params.userId,
    consumedAt: { gte: params.from, lte: params.to },
  };

  const [totals, byType, dayRows, sourced] = await Promise.all([
    prisma.meal.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalCarbsGrams: true, totalCalories: true },
      _avg: { totalCarbsGrams: true },
    }),
    prisma.meal.groupBy({
      by: ["mealType"],
      where,
      _count: { _all: true },
      _avg: { totalCarbsGrams: true },
    }),
    prisma.$queryRaw<Array<{ days: bigint }>>`
      SELECT COUNT(DISTINCT DATE("consumedAt"))::bigint AS days
      FROM "Meal"
      WHERE "userId" = ${params.userId}
        AND "consumedAt" >= ${params.from}
        AND "consumedAt" <= ${params.to}
    `,
    prisma.meal.count({ where: { ...where, nutritionSource: { not: null } } }),
  ]);

  const daysWithMeals = Number(dayRows[0]?.days ?? 0);
  const periodDays = Math.max(
    1,
    Math.round((params.to.getTime() - params.from.getTime()) / 86_400_000),
  );
  const mealCount = totals._count._all;

  return {
    mealCount,
    daysWithMeals,
    periodDays,
    mealsPerDay: mealCount > 0 ? round(mealCount / periodDays, 2) : null,
    totalCarbsGrams: round(totals._sum.totalCarbsGrams, 1),
    averageCarbsPerMeal: round(totals._avg.totalCarbsGrams, 1),
    averageCarbsPerDay:
      daysWithMeals > 0 && totals._sum.totalCarbsGrams !== null
        ? round(totals._sum.totalCarbsGrams / daysWithMeals, 1)
        : null,
    totalCalories: round(totals._sum.totalCalories, 0),
    averageCaloriesPerDay:
      daysWithMeals > 0 && totals._sum.totalCalories !== null
        ? round(totals._sum.totalCalories / daysWithMeals, 0)
        : null,
    mealsWithNutritionSource: sourced,
    byMealType: byType.map((row) => ({
      mealType: row.mealType,
      count: row._count._all,
      averageCarbsGrams: round(row._avg.totalCarbsGrams, 1),
    })),
  };
}

export async function getNutritionTrend(params: {
  userId: string;
  from: Date;
  to: Date;
  interval: TrendInterval;
}) {
  const truncUnit = Prisma.raw(`'${TRUNC_UNIT[params.interval]}'`);

  const rows = await prisma.$queryRaw<
    Array<{ bucket: Date; meals: bigint; carbs: number | null; calories: number | null }>
  >`
    SELECT
      DATE_TRUNC(${truncUnit}, "consumedAt") AS bucket,
      COUNT(*)::bigint                       AS meals,
      SUM("totalCarbsGrams")                 AS carbs,
      SUM("totalCalories")                   AS calories
    FROM "Meal"
    WHERE "userId" = ${params.userId}
      AND "consumedAt" >= ${params.from}
      AND "consumedAt" <= ${params.to}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  return rows.map((row) => ({
    bucket: row.bucket.toISOString(),
    meals: Number(row.meals),
    carbsGrams: round(row.carbs, 1),
    calories: round(row.calories, 0),
  }));
}
