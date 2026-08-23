import { z } from "zod";

/**
 * Building blocks shared by every domain schema.
 *
 * The backend is the final authority on input — the Flutter client validating
 * a field changes nothing here.
 */

/** Prisma `cuid()` identifiers; also tolerates cuid2 and uuid shapes. */
export const idSchema = z
  .string()
  .trim()
  .min(1, "An identifier is required.")
  .max(64, "Identifier is too long.")
  .regex(/^[A-Za-z0-9_-]+$/, "Identifier contains invalid characters.");

export const idParamSchema = z.object({ id: idSchema });

export const checkEmailQuerySchema = z.object({ email: z.email().max(254) });

/** Accepts an ISO-8601 timestamp and normalises it to a `Date`. */
export const isoDateTime = z.iso
  .datetime({ offset: true, local: true })
  .transform((value) => new Date(value));

/** Accepts `YYYY-MM-DD` or a full timestamp. */
export const flexibleDate = z
  .union([z.iso.date(), z.iso.datetime({ offset: true, local: true })])
  .transform((value) => new Date(value));

/**
 * A measurement timestamp. Rejects values in the future beyond a small clock
 * skew allowance, and values implausibly far in the past.
 */
export const measuredAtSchema = isoDateTime.refine(
  (date) => {
    const now = Date.now();
    const skewMs = 5 * 60 * 1000;
    const tenYearsMs = 10 * 365 * 24 * 60 * 60 * 1000;
    return date.getTime() <= now + skewMs && date.getTime() >= now - tenYearsMs;
  },
  { message: "Timestamp must be in the past and within the last 10 years." },
);

export const notesSchema = z
  .string()
  .trim()
  .max(2000, "Notes may not exceed 2000 characters.")
  .optional();

export const shortTextSchema = (max = 200) =>
  z.string().trim().min(1, "This field is required.").max(max);

/** Local time of day, e.g. "08:00" or "20:30". */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use a 24-hour time such as 08:00.");

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(
    (value) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Unrecognised IANA time zone." },
  );

// ---------------------------------------------------------------------------
// Pagination and sorting
// ---------------------------------------------------------------------------

export const MAX_PAGE_SIZE = 100;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function toSkipTake(pagination: Pagination) {
  return {
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
  };
}

export const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

/** Restricts sorting to an explicit allow-list, preventing arbitrary field access. */
export function sortBySchema<const T extends readonly [string, ...string[]]>(
  fields: T,
  fallback: T[number],
) {
  return z.enum(fields).default(fallback as never);
}

// ---------------------------------------------------------------------------
// Date ranges
// ---------------------------------------------------------------------------

export const dateRangePresetSchema = z.enum([
  "7d",
  "30d",
  "90d",
  "6m",
  "1y",
  "all",
  "custom",
]);

export type DateRangePreset = z.infer<typeof dateRangePresetSchema>;

export const dateRangeSchema = z
  .object({
    range: dateRangePresetSchema.default("30d"),
    from: flexibleDate.optional(),
    to: flexibleDate.optional(),
  })
  .refine(
    (value) => value.range !== "custom" || (value.from !== undefined && value.to !== undefined),
    { message: "A custom range requires both 'from' and 'to'.", path: ["range"] },
  )
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    { message: "'from' must not be after 'to'.", path: ["from"] },
  );

export type DateRangeInput = z.infer<typeof dateRangeSchema>;

/** Resolves a preset or explicit range into concrete boundaries. */
export function resolveDateRange(input: DateRangeInput): { from: Date; to: Date } {
  const to = input.to ?? new Date();

  if (input.range === "custom" && input.from) {
    return { from: input.from, to };
  }

  const from = new Date(to);
  switch (input.range) {
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "90d":
      from.setDate(from.getDate() - 90);
      break;
    case "6m":
      from.setMonth(from.getMonth() - 6);
      break;
    case "1y":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "all":
      from.setFullYear(from.getFullYear() - 50);
      break;
    case "custom":
      // `from` is guaranteed by the schema refinement; this is unreachable.
      break;
  }
  return { from, to };
}

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "6m": "6 months",
  "1y": "1 year",
  all: "All time",
  custom: "Custom",
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export const searchSchema = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => (value === "" ? undefined : value));

/** Optional single-value or repeated query parameter, normalised to an array. */
export function multiEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .union([z.enum(values), z.array(z.enum(values))])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value],
    );
}
