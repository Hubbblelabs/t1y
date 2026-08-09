-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'ADMIN', 'SUPER_ADMIN', 'RESEARCHER', 'CLINICAL_REVIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DiabetesType" AS ENUM ('TYPE_1', 'TYPE_2', 'GESTATIONAL', 'PREDIABETES', 'MODY', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "TreatmentModality" AS ENUM ('LIFESTYLE_ONLY', 'ORAL_MEDICATION', 'INSULIN', 'ORAL_AND_INSULIN', 'NON_INSULIN_INJECTABLE', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('FEMALE', 'MALE', 'INTERSEX', 'PREFER_NOT_TO_SAY', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "GlucoseUnit" AS ENUM ('MG_DL', 'MMOL_L');

-- CreateEnum
CREATE TYPE "GlucoseContext" AS ENUM ('FASTING', 'PRE_MEAL', 'POST_MEAL', 'BEDTIME', 'OVERNIGHT', 'PRE_EXERCISE', 'POST_EXERCISE', 'RANDOM');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('MANUAL', 'DEVICE', 'IMPORT', 'CLINICIAN');

-- CreateEnum
CREATE TYPE "MedicationForm" AS ENUM ('TABLET', 'CAPSULE', 'LIQUID', 'INJECTION', 'PATCH', 'INHALER', 'OTHER');

-- CreateEnum
CREATE TYPE "MedicationLogStatus" AS ENUM ('PENDING', 'TAKEN', 'MISSED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "InsulinType" AS ENUM ('RAPID_ACTING', 'SHORT_ACTING', 'INTERMEDIATE_ACTING', 'LONG_ACTING', 'ULTRA_LONG_ACTING', 'PREMIXED', 'OTHER');

-- CreateEnum
CREATE TYPE "InjectionSite" AS ENUM ('ABDOMEN', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_THIGH', 'RIGHT_THIGH', 'LEFT_BUTTOCK', 'RIGHT_BUTTOCK', 'OTHER');

-- CreateEnum
CREATE TYPE "MealAssociation" AS ENUM ('BEFORE_MEAL', 'WITH_MEAL', 'AFTER_MEAL', 'BEDTIME', 'CORRECTION', 'NONE');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER');

-- CreateEnum
CREATE TYPE "ExerciseCategory" AS ENUM ('AEROBIC', 'STRENGTH', 'FLEXIBILITY', 'BALANCE', 'BREATHING', 'WALKING', 'YOGA', 'OTHER');

-- CreateEnum
CREATE TYPE "ExerciseIntensity" AS ENUM ('LIGHT', 'MODERATE', 'VIGOROUS');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "HbA1cSource" AS ENUM ('LABORATORY', 'POINT_OF_CARE', 'SELF_REPORTED');

-- CreateEnum
CREATE TYPE "MetricValueType" AS ENUM ('NUMERIC', 'COMPOSITE', 'TEXT');

-- CreateEnum
CREATE TYPE "EducationCategory" AS ENUM ('DIABETES_BASICS', 'GLUCOSE_MANAGEMENT', 'MEDICATION', 'INSULIN', 'NUTRITION', 'EXERCISE', 'LIFESTYLE', 'STRESS_MANAGEMENT', 'GENERAL_WELLNESS');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('NONE', 'IMAGE', 'VIDEO', 'PDF', 'AUDIO');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MEDICATION_REMINDER', 'GLUCOSE_REMINDER', 'EXERCISE_REMINDER', 'HBA1C_REMINDER', 'EDUCATION', 'GENERAL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignTargetType" AS ENUM ('ALL_PARTICIPANTS', 'ROLE', 'STUDY', 'SPECIFIC_USERS');

-- CreateEnum
CREATE TYPE "ReminderRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "StudyStatus" AS ENUM ('DRAFT', 'RECRUITING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('INVITED', 'ENROLLED', 'ACTIVE', 'WITHDRAWN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StudyAccessRole" AS ENUM ('LEAD_INVESTIGATOR', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'XLSX', 'PDF');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ThresholdScope" AS ENUM ('GLOBAL', 'STUDY', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'VIDEO', 'PDF', 'AUDIO', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "lastLoginAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastRequest" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "participantCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "sex" "Sex" NOT NULL DEFAULT 'UNSPECIFIED',
    "phone" TEXT,
    "city" TEXT,
    "country" TEXT,
    "diabetesType" "DiabetesType" NOT NULL DEFAULT 'UNSPECIFIED',
    "diagnosisYear" INTEGER,
    "treatmentModality" "TreatmentModality" NOT NULL DEFAULT 'UNSPECIFIED',
    "heightCm" DOUBLE PRECISION,
    "baselineWeightKg" DOUBLE PRECISION,
    "primaryClinician" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "organization" TEXT,
    "phone" TEXT,
    "invitedById" TEXT,
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlucoseReading" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" "GlucoseUnit" NOT NULL DEFAULT 'MG_DL',
    "context" "GlucoseContext" NOT NULL DEFAULT 'RANDOM',
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "deviceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlucoseReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "dosageText" TEXT NOT NULL,
    "form" "MedicationForm" NOT NULL DEFAULT 'TABLET',
    "route" TEXT,
    "frequency" TEXT NOT NULL,
    "timesPerDay" INTEGER NOT NULL DEFAULT 1,
    "scheduleTimes" TEXT[],
    "instructions" TEXT,
    "prescribedBy" TEXT,
    "reason" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "takenAt" TIMESTAMP(3),
    "status" "MedicationLogStatus" NOT NULL DEFAULT 'PENDING',
    "doseAmount" DOUBLE PRECISION,
    "doseUnit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsulinLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "insulinName" TEXT NOT NULL,
    "insulinType" "InsulinType" NOT NULL,
    "doseUnits" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'IU',
    "administeredAt" TIMESTAMP(3) NOT NULL,
    "injectionSite" "InjectionSite",
    "mealAssociation" "MealAssociation" NOT NULL DEFAULT 'NONE',
    "mealId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsulinLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "mealType" "MealType" NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL,
    "totalCarbsGrams" DOUBLE PRECISION,
    "totalCalories" DOUBLE PRECISION,
    "totalProteinGrams" DOUBLE PRECISION,
    "totalFatGrams" DOUBLE PRECISION,
    "totalFiberGrams" DOUBLE PRECISION,
    "nutritionSource" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealItem" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'serving',
    "carbsGrams" DOUBLE PRECISION,
    "calories" DOUBLE PRECISION,
    "proteinGrams" DOUBLE PRECISION,
    "fatGrams" DOUBLE PRECISION,
    "fiberGrams" DOUBLE PRECISION,
    "referenceCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ExerciseCategory" NOT NULL DEFAULT 'OTHER',
    "metValue" DOUBLE PRECISION,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT,
    "programId" TEXT,
    "activityName" TEXT NOT NULL,
    "category" "ExerciseCategory" NOT NULL DEFAULT 'OTHER',
    "durationMinutes" INTEGER NOT NULL,
    "intensity" "ExerciseIntensity" NOT NULL DEFAULT 'MODERATE',
    "caloriesBurned" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "steps" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HbA1cRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "valuePercent" DOUBLE PRECISION NOT NULL,
    "valueMmolMol" DOUBLE PRECISION,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "source" "HbA1cSource" NOT NULL DEFAULT 'LABORATORY',
    "laboratoryName" TEXT,
    "orderedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HbA1cRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthMetricDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "valueType" "MetricValueType" NOT NULL DEFAULT 'NUMERIC',
    "primaryLabel" TEXT,
    "secondaryLabel" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "precision" INTEGER NOT NULL DEFAULT 1,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthMetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "secondaryValue" DOUBLE PRECISION,
    "textValue" TEXT,
    "unit" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalThreshold" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" "ThresholdScope" NOT NULL DEFAULT 'GLOBAL',
    "studyId" TEXT,
    "userId" TEXT,
    "domain" TEXT NOT NULL,
    "context" TEXT,
    "definitionId" TEXT,
    "unit" TEXT NOT NULL,
    "lowValue" DOUBLE PRECISION,
    "highValue" DOUBLE PRECISION,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "timeOfDay" TEXT,
    "recurrence" "ReminderRecurrence" NOT NULL DEFAULT 'DAILY',
    "daysOfWeek" INTEGER[],
    "dayOfMonth" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "medicationId" TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "nextTriggerAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'GENERAL',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "targetType" "CampaignTargetType" NOT NULL DEFAULT 'ALL_PARTICIPANTS',
    "targetRole" "UserRole",
    "targetStudyId" TEXT,
    "targetUserIds" TEXT[],
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "appVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationContent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "excerpt" TEXT,
    "category" "EducationCategory" NOT NULL,
    "body" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL DEFAULT 'NONE',
    "mediaUrl" TEXT,
    "mediaKey" TEXT,
    "thumbnailUrl" TEXT,
    "durationMinutes" INTEGER,
    "readingTimeMinutes" INTEGER,
    "externalReferences" TEXT[],
    "tags" TEXT[],
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseContent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExerciseCategory" NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'BEGINNER',
    "durationMinutes" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "equipment" TEXT[],
    "precautions" TEXT,
    "videoUrl" TEXT,
    "videoKey" TEXT,
    "imageUrl" TEXT,
    "imageKey" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" "AssetKind" NOT NULL DEFAULT 'OTHER',
    "purpose" TEXT NOT NULL,
    "checksum" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchStudy" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "status" "StudyStatus" NOT NULL DEFAULT 'DRAFT',
    "principalInvestigator" TEXT,
    "irbNumber" TEXT,
    "consentVersion" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "targetEnrollment" INTEGER,
    "dataPoints" TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyParticipant" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyParticipantCode" TEXT NOT NULL,
    "enrollmentStatus" "EnrollmentStatus" NOT NULL DEFAULT 'INVITED',
    "armOrGroup" TEXT,
    "consentGivenAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawalReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyAccess" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "StudyAccessRole" NOT NULL DEFAULT 'VIEWER',
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExport" (
    "id" TEXT NOT NULL,
    "studyId" TEXT,
    "datasetType" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "filters" JSONB NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER,
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "errorReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorRole" "UserRole",
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "participantId" TEXT,
    "studyId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "Verification_expiresAt_idx" ON "Verification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE INDEX "RateLimit_key_idx" ON "RateLimit"("key");

-- CreateIndex
CREATE INDEX "ApiRateLimit_expiresAt_idx" ON "ApiRateLimit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_participantCode_key" ON "Profile"("participantCode");

-- CreateIndex
CREATE INDEX "Profile_diabetesType_idx" ON "Profile"("diabetesType");

-- CreateIndex
CREATE INDEX "Profile_lastActivityAt_idx" ON "Profile"("lastActivityAt");

-- CreateIndex
CREATE INDEX "Profile_lastName_firstName_idx" ON "Profile"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_userId_key" ON "AdminUser"("userId");

-- CreateIndex
CREATE INDEX "GlucoseReading_userId_measuredAt_idx" ON "GlucoseReading"("userId", "measuredAt");

-- CreateIndex
CREATE INDEX "GlucoseReading_userId_context_measuredAt_idx" ON "GlucoseReading"("userId", "context", "measuredAt");

-- CreateIndex
CREATE INDEX "GlucoseReading_measuredAt_idx" ON "GlucoseReading"("measuredAt");

-- CreateIndex
CREATE INDEX "Medication_userId_isActive_idx" ON "Medication"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Medication_userId_startDate_idx" ON "Medication"("userId", "startDate");

-- CreateIndex
CREATE INDEX "MedicationLog_userId_scheduledFor_idx" ON "MedicationLog"("userId", "scheduledFor");

-- CreateIndex
CREATE INDEX "MedicationLog_userId_status_scheduledFor_idx" ON "MedicationLog"("userId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "MedicationLog_medicationId_status_idx" ON "MedicationLog"("medicationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationLog_medicationId_scheduledFor_key" ON "MedicationLog"("medicationId", "scheduledFor");

-- CreateIndex
CREATE INDEX "InsulinLog_userId_administeredAt_idx" ON "InsulinLog"("userId", "administeredAt");

-- CreateIndex
CREATE INDEX "InsulinLog_userId_insulinType_administeredAt_idx" ON "InsulinLog"("userId", "insulinType", "administeredAt");

-- CreateIndex
CREATE INDEX "Meal_userId_consumedAt_idx" ON "Meal"("userId", "consumedAt");

-- CreateIndex
CREATE INDEX "Meal_userId_mealType_consumedAt_idx" ON "Meal"("userId", "mealType", "consumedAt");

-- CreateIndex
CREATE INDEX "MealItem_mealId_idx" ON "MealItem"("mealId");

-- CreateIndex
CREATE INDEX "Exercise_category_isActive_idx" ON "Exercise"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_createdById_key" ON "Exercise"("name", "createdById");

-- CreateIndex
CREATE INDEX "ExerciseLog_userId_performedAt_idx" ON "ExerciseLog"("userId", "performedAt");

-- CreateIndex
CREATE INDEX "ExerciseLog_userId_category_performedAt_idx" ON "ExerciseLog"("userId", "category", "performedAt");

-- CreateIndex
CREATE INDEX "HbA1cRecord_userId_measuredAt_idx" ON "HbA1cRecord"("userId", "measuredAt");

-- CreateIndex
CREATE INDEX "HbA1cRecord_measuredAt_idx" ON "HbA1cRecord"("measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "HbA1cRecord_userId_measuredAt_key" ON "HbA1cRecord"("userId", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "HealthMetricDefinition_key_key" ON "HealthMetricDefinition"("key");

-- CreateIndex
CREATE INDEX "HealthMetricDefinition_isActive_sortOrder_idx" ON "HealthMetricDefinition"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "HealthMetric_userId_definitionId_measuredAt_idx" ON "HealthMetric"("userId", "definitionId", "measuredAt");

-- CreateIndex
CREATE INDEX "HealthMetric_userId_measuredAt_idx" ON "HealthMetric"("userId", "measuredAt");

-- CreateIndex
CREATE INDEX "ClinicalThreshold_domain_isActive_idx" ON "ClinicalThreshold"("domain", "isActive");

-- CreateIndex
CREATE INDEX "ClinicalThreshold_scope_studyId_idx" ON "ClinicalThreshold"("scope", "studyId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalThreshold_key_scope_studyId_userId_key" ON "ClinicalThreshold"("key", "scope", "studyId", "userId");

-- CreateIndex
CREATE INDEX "Reminder_userId_enabled_idx" ON "Reminder"("userId", "enabled");

-- CreateIndex
CREATE INDEX "Reminder_enabled_nextTriggerAt_idx" ON "Reminder"("enabled", "nextTriggerAt");

-- CreateIndex
CREATE INDEX "NotificationCampaign_status_scheduledAt_idx" ON "NotificationCampaign"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationCampaign_createdAt_idx" ON "NotificationCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_campaignId_idx" ON "Notification"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_isActive_idx" ON "DeviceToken"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EducationContent_slug_key" ON "EducationContent"("slug");

-- CreateIndex
CREATE INDEX "EducationContent_status_category_idx" ON "EducationContent"("status", "category");

-- CreateIndex
CREATE INDEX "EducationContent_status_publishedAt_idx" ON "EducationContent"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "EducationContent_category_idx" ON "EducationContent"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseContent_slug_key" ON "ExerciseContent"("slug");

-- CreateIndex
CREATE INDEX "ExerciseContent_status_category_idx" ON "ExerciseContent"("status", "category");

-- CreateIndex
CREATE INDEX "ExerciseContent_status_difficulty_idx" ON "ExerciseContent"("status", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_key_key" ON "MediaAsset"("key");

-- CreateIndex
CREATE INDEX "MediaAsset_uploadedById_createdAt_idx" ON "MediaAsset"("uploadedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchStudy_code_key" ON "ResearchStudy"("code");

-- CreateIndex
CREATE INDEX "ResearchStudy_status_idx" ON "ResearchStudy"("status");

-- CreateIndex
CREATE INDEX "ResearchStudy_createdAt_idx" ON "ResearchStudy"("createdAt");

-- CreateIndex
CREATE INDEX "StudyParticipant_studyId_enrollmentStatus_idx" ON "StudyParticipant"("studyId", "enrollmentStatus");

-- CreateIndex
CREATE INDEX "StudyParticipant_userId_idx" ON "StudyParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyParticipant_studyId_userId_key" ON "StudyParticipant"("studyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyParticipant_studyId_studyParticipantCode_key" ON "StudyParticipant"("studyId", "studyParticipantCode");

-- CreateIndex
CREATE INDEX "StudyAccess_userId_idx" ON "StudyAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyAccess_studyId_userId_key" ON "StudyAccess"("studyId", "userId");

-- CreateIndex
CREATE INDEX "DataExport_requestedById_createdAt_idx" ON "DataExport"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "DataExport_status_idx" ON "DataExport"("status");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_participantId_createdAt_idx" ON "AuditLog"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlucoseReading" ADD CONSTRAINT "GlucoseReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationLog" ADD CONSTRAINT "MedicationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationLog" ADD CONSTRAINT "MedicationLog_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsulinLog" ADD CONSTRAINT "InsulinLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsulinLog" ADD CONSTRAINT "InsulinLog_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ExerciseContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HbA1cRecord" ADD CONSTRAINT "HbA1cRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthMetric" ADD CONSTRAINT "HealthMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthMetric" ADD CONSTRAINT "HealthMetric_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "HealthMetricDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalThreshold" ADD CONSTRAINT "ClinicalThreshold_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "ResearchStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalThreshold" ADD CONSTRAINT "ClinicalThreshold_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "HealthMetricDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationCampaign" ADD CONSTRAINT "NotificationCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationCampaign" ADD CONSTRAINT "NotificationCampaign_targetStudyId_fkey" FOREIGN KEY ("targetStudyId") REFERENCES "ResearchStudy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationContent" ADD CONSTRAINT "EducationContent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseContent" ADD CONSTRAINT "ExerciseContent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchStudy" ADD CONSTRAINT "ResearchStudy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyParticipant" ADD CONSTRAINT "StudyParticipant_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "ResearchStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyParticipant" ADD CONSTRAINT "StudyParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyAccess" ADD CONSTRAINT "StudyAccess_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "ResearchStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyAccess" ADD CONSTRAINT "StudyAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "ResearchStudy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
