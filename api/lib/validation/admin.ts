import { z } from "zod";

import {
  dateRangeSchema,
  flexibleDate,
  idSchema,
  multiEnum,
  paginationSchema,
  searchSchema,
  shortTextSchema,
  sortBySchema,
  sortOrderSchema,
} from "@/lib/validation/common";
import { exerciseCategorySchema, notificationTypeSchema } from "@/lib/validation/health";

/** Input schemas for the administration and research APIs. */

export const userStatusSchema = z.enum(["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED"]);
export const diabetesTypeSchema = z.enum([
  "TYPE_1",
  "TYPE_2",
  "GESTATIONAL",
  "PREDIABETES",
  "MODY",
  "OTHER",
  "UNSPECIFIED",
]);
export const treatmentModalitySchema = z.enum([
  "LIFESTYLE_ONLY",
  "ORAL_MEDICATION",
  "INSULIN",
  "ORAL_AND_INSULIN",
  "NON_INSULIN_INJECTABLE",
  "OTHER",
  "UNSPECIFIED",
]);
export const staffRoleSchema = z.enum([
  "ADMIN",
  "SUPER_ADMIN",
  "RESEARCHER",
  "CLINICAL_REVIEWER",
]);
export const contentStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const educationCategorySchema = z.enum([
  "DIABETES_BASICS",
  "GLUCOSE_MANAGEMENT",
  "MEDICATION",
  "INSULIN",
  "NUTRITION",
  "EXERCISE",
  "LIFESTYLE",
  "STRESS_MANAGEMENT",
  "GENERAL_WELLNESS",
]);
export const difficultySchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export const studyStatusSchema = z.enum([
  "DRAFT",
  "RECRUITING",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
]);
export const enrollmentStatusSchema = z.enum([
  "INVITED",
  "ENROLLED",
  "ACTIVE",
  "WITHDRAWN",
  "COMPLETED",
]);

const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only.");

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export const participantListQuerySchema = z
  .object({
    search: searchSchema,
    status: multiEnum(["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED"]),
    diabetesType: multiEnum([
      "TYPE_1",
      "TYPE_2",
      "GESTATIONAL",
      "PREDIABETES",
      "MODY",
      "OTHER",
      "UNSPECIFIED",
    ]),
    studyId: idSchema.optional(),
    joinedFrom: flexibleDate.optional(),
    joinedTo: flexibleDate.optional(),
    sortBy: sortBySchema(
      ["name", "participantCode", "createdAt", "lastActivityAt", "diabetesType", "status"],
      "createdAt",
    ),
    sortOrder: sortOrderSchema,
  })
  .and(paginationSchema);

export const createParticipantSchema = z.object({
  email: z.email().max(254),
  firstName: shortTextSchema(80),
  lastName: shortTextSchema(80),
  participantCode: z
    .string()
    .trim()
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens and underscores only.")
    .optional(),
  diabetesType: diabetesTypeSchema.optional(),
  diagnosisYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  phone: z.string().trim().max(32).optional(),
  timezone: z.string().trim().max(64).optional(),
});

export const updateParticipantSchema = z.object({
  status: userStatusSchema.optional(),
  profile: z
    .object({
      firstName: shortTextSchema(80).optional(),
      lastName: shortTextSchema(80).optional(),
      phone: z.string().trim().max(32).nullish(),
      city: z.string().trim().max(80).nullish(),
      country: z.string().trim().max(80).nullish(),
      diabetesType: diabetesTypeSchema.optional(),
      diagnosisYear: z.number().int().min(1900).max(new Date().getFullYear()).nullish(),
      treatmentModality: treatmentModalitySchema.optional(),
      heightCm: z.number().finite().min(50).max(280).nullish(),
      baselineWeightKg: z.number().finite().min(10).max(500).nullish(),
      primaryClinician: z.string().trim().max(120).nullish(),
      emergencyContactName: z.string().trim().max(120).nullish(),
      emergencyContactPhone: z.string().trim().max(32).nullish(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export const analyticsQuerySchema = z
  .object({
    interval: z.enum(["hour", "day", "week", "month"]).default("day"),
  })
  .and(dateRangeSchema);

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

export const educationListQuerySchema = z
  .object({
    status: contentStatusSchema.optional(),
    category: educationCategorySchema.optional(),
    search: searchSchema,
  })
  .and(paginationSchema);

export const createEducationSchema = z.object({
  slug: slugSchema,
  title: shortTextSchema(200),
  description: z.string().trim().max(500).optional(),
  excerpt: z.string().trim().max(300).optional(),
  category: educationCategorySchema,
  /** Rich text; sanitised server-side before storage. */
  body: z.string().min(1).max(200_000),
  mediaType: z.enum(["NONE", "IMAGE", "VIDEO", "PDF", "AUDIO"]).default("NONE"),
  mediaUrl: z.url().max(2000).nullish(),
  mediaKey: z.string().trim().max(500).nullish(),
  thumbnailUrl: z.url().max(2000).nullish(),
  durationMinutes: z.number().int().min(0).max(1000).nullish(),
  externalReferences: z.array(z.string().trim().max(500)).max(30).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  status: contentStatusSchema.default("DRAFT"),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const updateEducationSchema = createEducationSchema.partial();

// ---------------------------------------------------------------------------
// Exercise programmes
// ---------------------------------------------------------------------------

export const programListQuerySchema = z
  .object({
    status: contentStatusSchema.optional(),
    category: exerciseCategorySchema.optional(),
    difficulty: difficultySchema.optional(),
    search: searchSchema,
  })
  .and(paginationSchema);

export const createProgramSchema = z.object({
  slug: slugSchema,
  title: shortTextSchema(200),
  description: shortTextSchema(1000),
  category: exerciseCategorySchema,
  difficulty: difficultySchema.default("BEGINNER"),
  durationMinutes: z.number().int().min(1).max(600),
  instructions: z.string().min(1).max(100_000),
  equipment: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  precautions: z.string().trim().max(2000).nullish(),
  videoUrl: z.url().max(2000).nullish(),
  videoKey: z.string().trim().max(500).nullish(),
  imageUrl: z.url().max(2000).nullish(),
  imageKey: z.string().trim().max(500).nullish(),
  status: contentStatusSchema.default("DRAFT"),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const updateProgramSchema = createProgramSchema.partial();

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const campaignListQuerySchema = z
  .object({
    status: z
      .enum(["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED", "FAILED"])
      .optional(),
    type: notificationTypeSchema.optional(),
  })
  .and(paginationSchema);

export const createCampaignSchema = z
  .object({
    title: shortTextSchema(120),
    /** Kept free of measurements — checked again in the service layer. */
    body: shortTextSchema(500),
    type: notificationTypeSchema.default("GENERAL"),
    targetType: z
      .enum(["ALL_PARTICIPANTS", "ROLE", "STUDY", "SPECIFIC_USERS"])
      .default("ALL_PARTICIPANTS"),
    targetRole: z
      .enum(["PATIENT", "ADMIN", "SUPER_ADMIN", "RESEARCHER", "CLINICAL_REVIEWER"])
      .optional(),
    targetStudyId: idSchema.optional(),
    targetUserIds: z.array(idSchema).max(5000).default([]),
    scheduledAt: z.iso
      .datetime({ offset: true, local: true })
      .transform((value) => new Date(value))
      .optional(),
  })
  .refine(
    (value) => !value.scheduledAt || value.scheduledAt.getTime() > Date.now(),
    { message: "The scheduled time must be in the future.", path: ["scheduledAt"] },
  );

export const updateCampaignSchema = z.object({
  title: shortTextSchema(120).optional(),
  body: shortTextSchema(500).optional(),
  type: notificationTypeSchema.optional(),
  scheduledAt: z.iso
    .datetime({ offset: true, local: true })
    .transform((value) => new Date(value))
    .optional(),
});

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

export const studyListQuerySchema = z
  .object({
    status: studyStatusSchema.optional(),
    search: searchSchema,
  })
  .and(paginationSchema);

export const createStudySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only."),
  title: shortTextSchema(200),
  description: z.string().trim().max(2000).optional(),
  objective: z.string().trim().max(2000).optional(),
  status: studyStatusSchema.default("DRAFT"),
  principalInvestigator: z.string().trim().max(160).optional(),
  irbNumber: z.string().trim().max(80).optional(),
  consentVersion: z.string().trim().max(40).optional(),
  startDate: flexibleDate.nullish(),
  endDate: flexibleDate.nullish(),
  targetEnrollment: z.number().int().min(1).max(1_000_000).nullish(),
  /** Health domains in scope for the study. */
  dataPoints: z
    .array(
      z.enum([
        "glucose",
        "medication",
        "insulin",
        "nutrition",
        "exercise",
        "hba1c",
        "health-metrics",
      ]),
    )
    .max(10)
    .default([]),
});

export const updateStudySchema = createStudySchema.partial();

export const enrollParticipantSchema = z.object({
  userId: idSchema,
  studyParticipantCode: z.string().trim().max(40).optional(),
  armOrGroup: z.string().trim().max(80).optional(),
  consentGivenAt: z.iso
    .datetime({ offset: true, local: true })
    .transform((value) => new Date(value))
    .optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateEnrollmentSchema = z.object({
  enrollmentStatus: enrollmentStatusSchema.optional(),
  armOrGroup: z.string().trim().max(80).nullish(),
  consentGivenAt: z.iso
    .datetime({ offset: true, local: true })
    .transform((value) => new Date(value))
    .nullish(),
  withdrawalReason: z.string().trim().max(500).nullish(),
  notes: z.string().trim().max(1000).nullish(),
});

export const grantAccessSchema = z.object({
  userId: idSchema,
  role: z.enum(["LEAD_INVESTIGATOR", "ANALYST", "VIEWER"]).default("VIEWER"),
  canExport: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const exportRequestSchema = z
  .object({
    datasetType: z.enum([
      "participant-summary",
      "glucose",
      "medication-adherence",
      "exercise",
      "hba1c",
      "health-metrics",
    ]),
    format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
    studyId: idSchema.optional(),
  })
  .and(dateRangeSchema);

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

export const uploadRequestSchema = z.object({
  purpose: z.enum([
    "education-media",
    "education-thumbnail",
    "exercise-video",
    "exercise-image",
    "export",
  ]),
  contentType: z.string().trim().min(3).max(120),
  sizeBytes: z.number().int().min(1).max(500 * 1024 * 1024),
  filename: z.string().trim().max(255).optional(),
});

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export const staffListQuerySchema = z
  .object({
    role: staffRoleSchema.optional(),
    status: userStatusSchema.optional(),
    search: searchSchema,
  })
  .and(paginationSchema);

export const createStaffSchema = z.object({
  email: z.email().max(254),
  name: shortTextSchema(120),
  role: staffRoleSchema,
  jobTitle: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  organization: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(32).optional(),
});

export const updateStaffSchema = z.object({
  name: shortTextSchema(120).optional(),
  role: staffRoleSchema.optional(),
  status: userStatusSchema.optional(),
  jobTitle: z.string().trim().max(120).nullish(),
  department: z.string().trim().max(120).nullish(),
  organization: z.string().trim().max(160).nullish(),
  phone: z.string().trim().max(32).nullish(),
});

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export const auditQuerySchema = z
  .object({
    actorId: idSchema.optional(),
    participantId: idSchema.optional(),
    action: z.string().trim().max(80).optional(),
    resourceType: z.string().trim().max(80).optional(),
    actorRole: z
      .enum(["PATIENT", "ADMIN", "SUPER_ADMIN", "RESEARCHER", "CLINICAL_REVIEWER"])
      .optional(),
    success: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
    search: searchSchema,
  })
  .and(paginationSchema)
  .and(dateRangeSchema);

// ---------------------------------------------------------------------------
// Clinical thresholds
// ---------------------------------------------------------------------------

export const thresholdListQuerySchema = z.object({
  domain: z.string().trim().max(40).optional(),
  scope: z.enum(["GLOBAL", "STUDY", "PARTICIPANT"]).optional(),
  studyId: idSchema.optional(),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const createThresholdSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9.\-_]+$/, "Use lowercase letters, digits, dots and hyphens."),
    scope: z.enum(["GLOBAL", "STUDY", "PARTICIPANT"]).default("GLOBAL"),
    studyId: idSchema.nullish(),
    userId: idSchema.nullish(),
    domain: z.string().trim().min(2).max(40),
    context: z.string().trim().max(40).nullish(),
    definitionId: idSchema.nullish(),
    unit: z.string().trim().min(1).max(20),
    lowValue: z.number().finite().nullish(),
    highValue: z.number().finite().nullish(),
    label: shortTextSchema(120),
    /**
     * Provenance is required. A threshold without a stated clinical source
     * would be an invented value, which the platform must not present.
     */
    source: shortTextSchema(300),
    isActive: z.boolean().default(true),
  })
  .refine(
    (value) => value.lowValue !== null || value.highValue !== null,
    { message: "Provide a lower bound, an upper bound, or both.", path: ["lowValue"] },
  )
  .refine(
    (value) =>
      value.lowValue === null ||
      value.lowValue === undefined ||
      value.highValue === null ||
      value.highValue === undefined ||
      value.lowValue <= value.highValue,
    { message: "The lower bound must not exceed the upper bound.", path: ["lowValue"] },
  )
  .refine((value) => value.scope !== "STUDY" || Boolean(value.studyId), {
    message: "A study-scoped threshold requires a study.",
    path: ["studyId"],
  })
  .refine((value) => value.scope !== "PARTICIPANT" || Boolean(value.userId), {
    message: "A participant-scoped threshold requires a participant.",
    path: ["userId"],
  });

export const updateThresholdSchema = z.object({
  unit: z.string().trim().min(1).max(20).optional(),
  lowValue: z.number().finite().nullish(),
  highValue: z.number().finite().nullish(),
  label: shortTextSchema(120).optional(),
  source: shortTextSchema(300).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const updateSettingsSchema = z.record(
  z.string().trim().min(1).max(80),
  z.union([z.string().max(500), z.number(), z.boolean()]),
);
