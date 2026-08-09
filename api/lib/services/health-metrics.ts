import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { round, touchParticipantActivity } from "@/lib/services/shared";

/**
 * Configurable health metrics.
 *
 * A metric is a row in `HealthMetricDefinition`, not a column. Adding "waist
 * circumference" or "sleep duration" later is an insert, and every query,
 * chart and export in the platform picks it up without a schema change.
 *
 * `COMPOSITE` metrics carry two numbers (blood pressure being the motivating
 * case); `NUMERIC` carries one; `TEXT` carries a short string.
 */

const METRIC_SELECT = {
  id: true,
  value: true,
  secondaryValue: true,
  textValue: true,
  unit: true,
  measuredAt: true,
  source: true,
  notes: true,
  createdAt: true,
  definition: {
    select: {
      id: true,
      key: true,
      label: true,
      unit: true,
      valueType: true,
      primaryLabel: true,
      secondaryLabel: true,
      precision: true,
    },
  },
} satisfies Prisma.HealthMetricSelect;

export async function listMetricDefinitions(includeInactive = false) {
  return prisma.healthMetricDefinition.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: {
      id: true,
      key: true,
      label: true,
      description: true,
      unit: true,
      valueType: true,
      primaryLabel: true,
      secondaryLabel: true,
      minValue: true,
      maxValue: true,
      precision: true,
      isSystem: true,
      isActive: true,
      sortOrder: true,
    },
  });
}

export async function resolveDefinition(params: {
  definitionId?: string;
  definitionKey?: string;
}) {
  const definition = await prisma.healthMetricDefinition.findFirst({
    where: params.definitionId
      ? { id: params.definitionId }
      : { key: params.definitionKey },
    select: {
      id: true,
      key: true,
      label: true,
      unit: true,
      valueType: true,
      minValue: true,
      maxValue: true,
      secondaryLabel: true,
      isActive: true,
    },
  });

  if (!definition) throw new NotFoundError("Health metric");
  if (!definition.isActive) {
    throw new ValidationError("This metric is no longer being collected.");
  }
  return definition;
}

export async function listHealthMetrics(params: {
  userId: string;
  from: Date;
  to: Date;
  definitionId?: string;
  definitionKey?: string;
  sortOrder: "asc" | "desc";
  skip: number;
  take: number;
}) {
  const where: Prisma.HealthMetricWhereInput = {
    userId: params.userId,
    measuredAt: { gte: params.from, lte: params.to },
    ...(params.definitionId ? { definitionId: params.definitionId } : {}),
    ...(params.definitionKey ? { definition: { key: params.definitionKey } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.healthMetric.findMany({
      where,
      select: METRIC_SELECT,
      orderBy: { measuredAt: params.sortOrder },
      skip: params.skip,
      take: params.take,
    }),
    prisma.healthMetric.count({ where }),
  ]);

  return { items, total };
}

export async function getHealthMetric(id: string) {
  const metric = await prisma.healthMetric.findUnique({
    where: { id },
    select: { ...METRIC_SELECT, userId: true },
  });
  if (!metric) throw new NotFoundError("Health metric record");
  return metric;
}

export interface CreateHealthMetricInput {
  definitionId?: string;
  definitionKey?: string;
  value?: number;
  secondaryValue?: number;
  textValue?: string;
  measuredAt: Date;
  source: "MANUAL" | "DEVICE" | "IMPORT" | "CLINICIAN";
  notes?: string;
}

export async function createHealthMetric(
  userId: string,
  input: CreateHealthMetricInput,
) {
  const definition = await resolveDefinition({
    definitionId: input.definitionId,
    definitionKey: input.definitionKey,
  });

  validateAgainstDefinition(definition, input);

  const metric = await prisma.healthMetric.create({
    data: {
      userId,
      definitionId: definition.id,
      value: input.value,
      secondaryValue: input.secondaryValue,
      textValue: input.textValue,
      unit: definition.unit,
      measuredAt: input.measuredAt,
      source: input.source,
      notes: input.notes,
    },
    select: METRIC_SELECT,
  });

  await touchParticipantActivity(userId);
  return metric;
}

/**
 * Enforces the definition's own rules: a composite metric needs both numbers,
 * a text metric needs a string, and values must fall inside the definition's
 * plausibility bounds (a data-entry guard, not a clinical assessment).
 */
function validateAgainstDefinition(
  definition: {
    key: string;
    label: string;
    valueType: string;
    minValue: number | null;
    maxValue: number | null;
    secondaryLabel: string | null;
  },
  input: { value?: number; secondaryValue?: number; textValue?: string },
): void {
  if (definition.valueType === "TEXT") {
    if (!input.textValue) {
      throw new ValidationError(`${definition.label} requires a text value.`, [
        { field: "textValue", message: "This metric expects a text value." },
      ]);
    }
    return;
  }

  if (input.value === undefined) {
    throw new ValidationError(`${definition.label} requires a numeric value.`, [
      { field: "value", message: "A numeric value is required." },
    ]);
  }

  if (definition.valueType === "COMPOSITE" && input.secondaryValue === undefined) {
    throw new ValidationError(
      `${definition.label} requires both ${definition.secondaryLabel ?? "values"}.`,
      [{ field: "secondaryValue", message: "A second value is required." }],
    );
  }

  const check = (name: "value" | "secondaryValue", candidate: number | undefined) => {
    if (candidate === undefined) return;
    if (definition.minValue !== null && candidate < definition.minValue) {
      throw new ValidationError(`${definition.label} is outside the accepted range.`, [
        {
          field: name,
          message: `Must be at least ${definition.minValue}.`,
        },
      ]);
    }
    if (definition.maxValue !== null && candidate > definition.maxValue) {
      throw new ValidationError(`${definition.label} is outside the accepted range.`, [
        {
          field: name,
          message: `Must be at most ${definition.maxValue}.`,
        },
      ]);
    }
  };

  check("value", input.value);
  check("secondaryValue", input.secondaryValue);
}

export async function updateHealthMetric(
  id: string,
  input: {
    value?: number;
    secondaryValue?: number | null;
    textValue?: string | null;
    measuredAt?: Date;
    notes?: string;
  },
) {
  return prisma.healthMetric.update({
    where: { id },
    data: input,
    select: METRIC_SELECT,
  });
}

export async function deleteHealthMetric(id: string): Promise<void> {
  await prisma.healthMetric.delete({ where: { id } });
}

export interface MetricSeries {
  definition: {
    id: string;
    key: string;
    label: string;
    unit: string;
    valueType: string;
    primaryLabel: string | null;
    secondaryLabel: string | null;
  };
  count: number;
  latest: { value: number | null; secondaryValue: number | null; measuredAt: Date } | null;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  points: Array<{ measuredAt: string; value: number | null; secondaryValue: number | null }>;
}

/** Every metric a participant has recorded, each with its own series. */
export async function getMetricSeriesForParticipant(params: {
  userId: string;
  from: Date;
  to: Date;
  pointLimit?: number;
}): Promise<MetricSeries[]> {
  const definitions = await prisma.healthMetricDefinition.findMany({
    where: { measurements: { some: { userId: params.userId } }, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: {
      id: true,
      key: true,
      label: true,
      unit: true,
      valueType: true,
      primaryLabel: true,
      secondaryLabel: true,
    },
  });

  return Promise.all(
    definitions.map(async (definition) => {
      const where: Prisma.HealthMetricWhereInput = {
        userId: params.userId,
        definitionId: definition.id,
        measuredAt: { gte: params.from, lte: params.to },
      };

      const [aggregate, points, latest] = await Promise.all([
        prisma.healthMetric.aggregate({
          where,
          _count: { _all: true },
          _avg: { value: true },
          _min: { value: true },
          _max: { value: true },
        }),
        prisma.healthMetric.findMany({
          where,
          orderBy: { measuredAt: "asc" },
          take: params.pointLimit ?? 200,
          select: { measuredAt: true, value: true, secondaryValue: true },
        }),
        prisma.healthMetric.findFirst({
          where: { userId: params.userId, definitionId: definition.id },
          orderBy: { measuredAt: "desc" },
          select: { value: true, secondaryValue: true, measuredAt: true },
        }),
      ]);

      return {
        definition,
        count: aggregate._count._all,
        latest,
        average: round(aggregate._avg.value, 1),
        minimum: round(aggregate._min.value, 1),
        maximum: round(aggregate._max.value, 1),
        points: points.map((point) => ({
          measuredAt: point.measuredAt.toISOString(),
          value: point.value,
          secondaryValue: point.secondaryValue,
        })),
      };
    }),
  );
}
