import { z } from "zod";
import { PARTICIPANT_FEATURE_KEYS } from "@/lib/services/participant-features";

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
import { STUDY_DIABETES_TYPE } from "@/lib/config/study-scope";
import { notificationTypeSchema } from "@/lib/validation/health";

/** Input schemas for the administration and research APIs. */

export const userStatusSchema = z.enum(["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED"]);
/**
 * This deployment's study is Type 1 only (BRD §1.1 inclusion criteria).
 * `Profile.diabetesType` in the schema still carries the platform's
 * original multi-condition values (TYPE_2, GESTATIONAL, PREDIABETES, MODY,
 * OTHER) — UNSPECIFIED stays selectable only because it's the column's
 * default for a row that hasn't captured this field yet, not because this
 * study has any use for it being set otherwise.
 */
export const diabetesTypeSchema = z.enum([STUDY_DIABETES_TYPE, "UNSPECIFIED"]);
export const treatmentModalitySchema = z.enum([
  "LIFESTYLE_ONLY",
  "ORAL_MEDICATION",
  "INSULIN",
  "ORAL_AND_INSULIN",
  "NON_INSULIN_INJECTABLE",
  "OTHER",
  "UNSPECIFIED",
]);
// ADMIN is the only staff role now (see lib/permissions/roles.ts).
export const staffRoleSchema = z.enum(["ADMIN"]);
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
  "HYPOGLYCAEMIA",
  "SCHOOL_MANAGEMENT",
  "TRAVEL",
  "DIABAG",
]);
export const contentLocaleSchema = z.enum(["EN", "TA"]);
export const contentBodyFormatSchema = z.enum(["MARKDOWN", "HTML"]);
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

export const slugSchema = z
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
  name: shortTextSchema(120),
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
  /** Defaults to every feature when left out — see createParticipant. */
  enabledFeatures: z.array(z.enum(PARTICIPANT_FEATURE_KEYS)).optional(),
});

export const bulkParticipantRowSchema = z
  .object({
    email: z.email().max(254),
    name: shortTextSchema(120),
    participantCode: z
      .string()
      .trim()
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens and underscores only.")
      .optional(),
    diabetesType: diabetesTypeSchema.optional(),
    diagnosisYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
    dateOfBirth: z.coerce.date().optional(),
    phone: z.string().trim().max(32).optional(),
  })
  .refine(
    (data) => {
      if (!data.dateOfBirth || data.diagnosisYear == null) return true;
      return data.diagnosisYear >= data.dateOfBirth.getFullYear();
    },
    { message: "Diagnosis year cannot be before the date of birth.", path: ["diagnosisYear"] },
  );

/** A 500-row cap keeps one import inside a single request's timeout budget. */
export const bulkImportParticipantsSchema = z.object({
  fileBase64: z.string().min(1),
  dummyPassword: z.string().min(12).max(128),
});

export const updateParticipantSchema = z.object({
  status: userStatusSchema.optional(),
  profile: z
    .object({
      name: shortTextSchema(120).optional(),
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
      icIsfUnlocked: z.boolean().optional(),
      enabledFeatures: z.array(z.enum(PARTICIPANT_FEATURE_KEYS)).optional(),
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
    locale: contentLocaleSchema.optional(),
    search: searchSchema,
  })
  .and(paginationSchema);

/**
 * One block of a Help Book topic.
 *
 * A topic is authored as an ordered list of these rather than as one rich-text
 * body: authors are clinical staff, not writers of Markdown, and the reading
 * screen needs to know where each image belongs rather than guessing from a
 * blob of HTML. A block carries text, an image, a video, or a heading with any
 * combination of those — including a video with no words at all, which several
 * source topics are.
 *
 * `kind` is optional for backward compatibility: rows written before blocks
 * grew images-or-video (the importer's `{paragraph, imageUrl}` shape, see
 * scripts/split-content-blocks.ts) have no `kind`, and readers infer it from
 * whichever media field is present. `imageUrl` is a site-relative
 * `/content/...` path or an absolute URL, not validated as a strict URL,
 * because the importer writes the former.
 */
/**
 * Where a picture or video lives: a full web address, or a path on this site
 * (`/uploads/...`, `/content/...`) — what uploads give back when there is no
 * cloud storage set up.
 */
const mediaLocationSchema = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) => (value.startsWith("/") && !value.startsWith("//")) || z.url().safeParse(value).success,
    { message: "Use a full web address or a path starting with /" },
  );

export const contentBlockSchema = z
  .object({
    kind: z.enum(["TEXT", "IMAGE", "VIDEO"]).optional(),
    /** Optional sub-heading shown above the block. */
    heading: z.string().trim().max(200).nullish(),
    /** May be empty for an image-only or video-only block. */
    paragraph: z.string().max(20_000).default(""),
    imageUrl: z.string().trim().max(2000).nullish(),
    imageKey: z.string().trim().max(2000).nullish(),
    videoUrl: z.string().trim().max(2000).nullish(),
  })
  .refine(
    (block) =>
      Boolean(block.paragraph?.trim() || block.heading?.trim() || block.imageUrl || block.videoUrl),
    { message: "A block needs words, a heading, an image or a video — it cannot be empty." },
  )
  .refine((block) => !(block.imageUrl && block.videoUrl), {
    message: "A block shows either an image or a video, not both.",
  });

/**
 * The ordered list of topics as a drag-and-drop left them. Slugs, not titles:
 * the two language versions of a topic share one slug and must move together.
 */
export const reorderTopicsSchema = z.object({
  order: z.array(slugSchema).min(1).max(500),
});

export const createEducationSchema = z.object({
  /**
   * Generated, not authored. A slug is a database join key here — it is what
   * pairs the English and Tamil versions of a topic — and nothing an admin
   * would recognise or should have to invent. Supplying one is still allowed,
   * because adding a *translation* means deliberately reusing the existing
   * topic's slug; omitting it mints a fresh one.
   */
  slug: slugSchema.optional(),
  locale: contentLocaleSchema.default("EN"),
  title: shortTextSchema(200),
  description: z.string().trim().max(500).optional(),
  excerpt: z.string().trim().max(300).optional(),
  category: educationCategorySchema,
  /**
   * Rich text; sanitised server-side before storage. Optional because a
   * block-authored topic has no separate body — the server derives one from
   * the blocks so that older readers, search and reading-time estimation all
   * keep working.
   */
  body: z.string().max(200_000).optional(),
  /** Author-editable source. When bodyFormat is MARKDOWN, `body` above is
   *  derived from this on save — see lib/utils/markdown.ts. */
  bodySource: z.string().max(200_000).optional(),
  bodyFormat: contentBodyFormatSchema.default("MARKDOWN"),
  /** The Help Book's block layout. Omitted entirely leaves whatever's
   *  already stored untouched on an update. */
  contentBlocks: z.array(contentBlockSchema).max(1000).optional(),
  mediaType: z.enum(["NONE", "IMAGE", "VIDEO", "PDF", "AUDIO"]).default("NONE"),
  mediaUrl: mediaLocationSchema.nullish(),
  mediaKey: z.string().trim().max(500).nullish(),
  thumbnailUrl: mediaLocationSchema.nullish(),
  durationMinutes: z.number().int().min(0).max(1000).nullish(),
  externalReferences: z.array(z.string().trim().max(500)).max(30).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  status: contentStatusSchema.default("DRAFT"),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

/** `locale` is immutable after creation — changing it would silently
 *  re-pair two unrelated topics. */
export const updateEducationSchema = createEducationSchema.partial().omit({ locale: true });

// ---------------------------------------------------------------------------
// Calculators
//
// A calculator is created once and never edited (see
// lib/services/calculators.ts), so there is deliberately no update schema
// here beyond the active/hidden toggle.
// ---------------------------------------------------------------------------

/** Names a formula can refer to: a letter or underscore, then word characters. */
const formulaNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letters, numbers and underscores, starting with a letter.");

export const calculatorInputSchema = z.object({
  key: formulaNameSchema,
  labelEn: shortTextSchema(120),
  labelTa: z.string().trim().max(120).nullish(),

  /**
   * What kind of value this is. Only numbers can take part in arithmetic, so
   * this is the single option today — it is declared explicitly rather than
   * assumed so that the definition sent to the app is self-describing, and so
   * adding a second kind later cannot silently change what existing
   * calculators mean.
   */
  valueType: z.enum(["NUMBER"]).default("NUMBER"),

  /**
   * Required, always.
   *
   * A calculator is a specification handed to the app, and a number with no
   * unit is not a specification — "enter your glucose" is ambiguous in a way
   * that "enter your glucose (mg/dL)" is not, and the difference between
   * mg/dL and mmol/L is a factor of eighteen in the resulting dose. The unit
   * is declared here, shown to the parent on the input, and shown again in
   * the admin's read-only view of the formula.
   */
  unit: z.string().trim().min(1).max(24),

  min: z.number().finite().nullish(),
  max: z.number().finite().nullish(),
  decimals: z.number().int().min(0).max(4).nullish(),

  /**
   * Free note shown under the input — the place for "only use this when the
   * reading is below 70" or "count the carbohydrates in the whole meal".
   */
  helpEn: z.string().trim().max(300).nullish(),
  helpTa: z.string().trim().max(300).nullish(),

  /**
   * Where the number comes from.
   *
   * ASK  — the parent types it on the calculator screen.
   * DATA — it is filled in from something already on file, named by
   *        `sourceKey` and drawn from the closed catalogue in
   *        lib/services/health-data-catalogue.ts.
   *
   * A DATA value is always shown to the parent with the time it was
   * recorded, and is always editable, so nothing is ever calculated from a
   * stale reading without it being visible.
   */
  source: z.enum(["ASK", "DATA"]).default("ASK"),
  sourceKey: z.string().trim().max(60).nullish(),
});

export const calculatorOutputSchema = z.object({
  key: formulaNameSchema,
  labelEn: shortTextSchema(120),
  labelTa: z.string().trim().max(120).nullish(),
  /** Required for the same reason as an input's unit — see above. */
  unit: z.string().trim().min(1).max(24),
  decimals: z.number().int().min(0).max(4).nullish(),
  /** Checked against the calculator's own inputs in the service layer. */
  expression: z.string().trim().min(1).max(500),
});

export const createCalculatorSchema = z.object({
  nameEn: shortTextSchema(120),
  nameTa: z.string().trim().max(120).nullish(),
  descriptionEn: z.string().trim().max(1000).nullish(),
  descriptionTa: z.string().trim().max(1000).nullish(),
  inputs: z.array(calculatorInputSchema).min(1).max(12),
  outputs: z.array(calculatorOutputSchema).min(1).max(12),
  noteEn: z.string().trim().max(1000).nullish(),
  noteTa: z.string().trim().max(1000).nullish(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  supersedesId: z.string().trim().max(40).nullish(),
});

/** The only change a stored calculator ever accepts. */
export const calculatorVisibilitySchema = z.object({
  active: z.boolean(),
});

/** Admin "try it" preview: run a draft calculator against sample numbers. */
export const calculatorPreviewSchema = z.object({
  inputs: z.array(calculatorInputSchema).min(1).max(12),
  outputs: z.array(calculatorOutputSchema).min(1).max(12),
  values: z.record(z.string(), z.number().finite()),
});

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
      .enum(["PATIENT", "ADMIN"])
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
  /** A temporary password the administrator hands over. The new staff member
   *  is made to replace it the first time they sign in. */
  password: z.string().min(8, "Use at least 8 characters.").max(128),
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
      .enum(["PATIENT", "ADMIN"])
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
    // `!= null` is deliberate: it rejects both an explicit null and an omitted
    // field. A threshold with neither bound could never classify a value.
    (value) => value.lowValue != null || value.highValue != null,
    { message: "Provide a lower bound, an upper bound, or both.", path: ["lowValue"] },
  )
  .refine(
    (value) =>
      value.lowValue == null ||
      value.highValue == null ||
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

// ---------------------------------------------------------------------------
// Profile field definitions
// ---------------------------------------------------------------------------

const choiceOptionSchema = z.object({
  value: z.string().trim().min(1).max(60),
  labelEn: z.string().trim().min(1).max(120),
  labelTa: z.string().trim().max(120).optional(),
  /**
   * What this choice counts as in a calculator.
   *
   * Only meaningful on a field marked as medical: a formula cannot do
   * arithmetic on the word "male", so a medical CHOICE field has to say what
   * number each option stands for before it can be used in one. Left unset,
   * the field simply never appears in the calculator data list.
   */
  numericValue: z.number().finite().nullish(),
});

/** Fields shared by creating and updating a profile question. */
const profileFieldMedicalFields = {
  /**
   * Declares this as clinical information about the child, which is what
   * makes it available to calculators. Off unless deliberately set — see the
   * model comment in schema.prisma.
   */
  isMedical: z.boolean().optional(),
  /** The unit a numeric medical field is recorded in: "kg", "cm", "mg/dL". */
  unit: z.string().trim().max(24).nullish(),
  /** Asked in the sign-up chat rather than left to the profile screen. */
  showOnSignup: z.boolean().optional(),
  /** The sentence the sign-up chat asks, when `showOnSignup` is on. */
  promptEn: z.string().trim().max(200).nullish(),
  promptTa: z.string().trim().max(200).nullish(),
  /**
   * The checks an answer must pass. Shape depends on the question's type, so
   * it is validated against that type in lib/services/profile-field-rules.ts
   * rather than here, where the type is not yet known for an update.
   */
  rules: z.record(z.string(), z.unknown()).nullish(),
};

export const createProfileFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z][a-zA-Z0-9]*$/, "Start with a lowercase letter; letters and digits only."),
  fieldType: z.enum(["TEXT", "NUMBER", "DATE", "CHOICE"]),
  section: z.string().trim().min(1).max(80).optional(),
  required: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  labelEn: z.string().trim().min(1).max(120),
  labelTa: z.string().trim().max(120).nullish(),
  hintEn: z.string().trim().max(200).nullish(),
  hintTa: z.string().trim().max(200).nullish(),
  options: z.array(choiceOptionSchema).max(30).nullish(),
  ...profileFieldMedicalFields,
});

export const updateProfileFieldSchema = z.object({
  section: z.string().trim().min(1).max(80).optional(),
  required: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  labelEn: z.string().trim().min(1).max(120).optional(),
  labelTa: z.string().trim().max(120).nullish(),
  hintEn: z.string().trim().max(200).nullish(),
  hintTa: z.string().trim().max(200).nullish(),
  options: z.array(choiceOptionSchema).max(30).nullish(),
  ...profileFieldMedicalFields,
});

// ---------------------------------------------------------------------------
// Help and support
// ---------------------------------------------------------------------------

export const supportThreadListQuerySchema = z.object({
  status: z.enum(["AWAITING_REPLY", "ANSWERED", "CLOSED"]).optional(),
});

export const supportReplySchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const supportStatusSchema = z.object({
  status: z.enum(["AWAITING_REPLY", "ANSWERED", "CLOSED"]),
});

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12, "Use at least 12 characters.").max(128),
});
