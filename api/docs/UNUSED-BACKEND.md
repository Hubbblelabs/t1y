# What's built but unused for T1D Prajana Yandra

This backend was originally built as a generic "Digital Diabetes Management
Platform" — a broad multi-condition, multi-study clinical data platform. The
actual product is narrower: a bilingual (English/Tamil) **education** app
delivering 8 curriculum topics, 2 calculators, and quizzes to 140 children
(6–15) in a single Coimbatore nursing PhD study, with a parent operating an
Android phone. v1 has **no health logging**.

This document tracks what the platform has that the product doesn't need, so
future work doesn't assume something is load-bearing when it isn't. Nothing
here has been deleted — schema, services and routes below all still exist and
still pass their tests. This is a map, not a changelog.

Reference-counted by grepping `app/ lib/ tests/ components/ prisma/`.

## Dead code — zero references anywhere

- **`MediaAsset` model + `AssetKind` enum** — 0 references outside the schema
  itself. `POST /api/admin/uploads` audits `resourceType: "media-asset"` but
  never writes a row. `scripts/import-content.ts` (added for this product)
  bypasses R2/`MediaAsset` entirely and writes resized WebP images straight
  to `public/content/`, keyed by content hash — a lighter-weight approach
  that fits a single-machine import run better than presigned-upload
  infrastructure built for a multi-admin, ongoing-upload workflow.
- Playwright's `mobile` project (`playwright.config.ts`) targets
  `responsive.spec.ts`, which doesn't exist — it matches zero tests.

## Write-only — created, never read back

- **`DeviceToken`** — registered by `POST /api/devices`, expired by the daily
  maintenance cron, but nothing ever reads a token to send a push. Neither
  cron job (`reminders`, `campaigns`) delivers anything; both only create
  `Notification` database rows. Push delivery was always meant to be "the
  Flutter application's concern" per the route's own comments — this app
  doesn't implement it, since v1 has no logging/reminder flows to notify
  about.
- **`DataExport`** — created by `POST /api/admin/exports`, deleted by the
  maintenance cron, never listed or downloaded. No retrieval endpoint exists
  for it. The 666-line `lib/services/exports.ts` and the `exceljs`/`pdf-lib`
  dependencies it pulls into production exist for datasets (glucose,
  medication adherence, HbA1c…) this product doesn't collect.

## Over-built for one 140-child study

- **Research subsystem** — `lib/services/research.ts` (510 LOC) +
  `lib/services/exports.ts` (666 LOC) + 6 admin routes + 3 dashboard pages +
  4 models (`ResearchStudy`, `StudyParticipant`, `StudyAccess`, `DataExport`)
  + `RESEARCH_*` capabilities, built for multi-study, multi-researcher,
  IRB/consent-versioned governance. This product's cohort progress instead
  went into two small new services — `lib/services/progress.ts` and the
  `getCohortProgress()` query — that read `TopicProgress`/`QuizAttempt`
  directly, no study model required. `ResearchStudy` etc. stay in the schema
  and keep working; they're just not this product's path for tracking
  adherence.
- **5-role capability matrix** — `lib/permissions/roles.ts` +
  `lib/permissions/policies.ts` (446 LOC, 27 guards, 18 capabilities)
  separating `RESEARCHER` / `CLINICAL_REVIEWER` / `ADMIN` / `SUPER_ADMIN`
  scopes. This product's admin surface (content, quizzes, feature flags) only
  really needs `ADMIN` + `SUPER_ADMIN`. The matrix is harmless to keep — the
  two new capabilities added for this product (`FEATURE_FLAGS_MANAGE`) follow
  its existing pattern rather than replacing it.

## Wrong domain for a Type 1 paediatric education app

- **`Medication` / `MedicationLog`** — a 544-LOC adherence engine
  (`lib/services/medications.ts`) with `generatePendingDoses` cron work.
  Oral-medication adherence tracking is a Type 2 diabetes concept; T1D
  management here is insulin, not scheduled oral doses.
- **`Meal` / `MealItem`** (295 LOC + nutrition trend queries),
  **`HealthMetric` / `HealthMetricDefinition`** (341 LOC generic
  definition-driven metric engine), **`ExerciseContent`** guided programmes +
  weekday-distribution analytics. All three are full CRUD + trend + admin
  browse subsystems for logging domains this product's v1 doesn't expose —
  there is no logging UI in the Flutter app at all (see "Governance" below
  for why).
- These stay in the schema and keep their admin pages — they get **no
  Flutter client** and **no new admin nav entries** for this product.

## Infrastructure assumptions that don't hold outside Vercel

- All three cron jobs (`reminders`, `campaigns`, `maintenance`) are
  registered as **Vercel Cron** in `vercel.json` and refuse to run unless
  `CRON_SECRET` is set. They never fire on a non-Vercel host without an
  external scheduler hitting the same routes.
- `@sentry/nextjs` is a **devDependency**, but `lib/observability/sentry.ts`
  is called from production code paths (`lib/api/handler.ts`, all 3 crons).
  No `sentry.*.config.ts` exists in the repo.
- `lib/storage/r2.ts` (185 LOC + `@aws-sdk/client-s3` +
  `@aws-sdk/s3-request-presigner`) has exactly one caller
  (`app/api/admin/uploads/route.ts`), and this product's content importer
  doesn't use it (see `MediaAsset` above).

## Seed data doesn't match the study

`prisma/seed.ts` (902 LOC) creates 24 synthetic **adult, mostly Type 2**
participants with a non-Indian name pool, one generic research study, and
health-domain sample data (meals, medications, exercise logs) this product
doesn't use. It's still useful for exercising the untouched parts of the
platform (health logging, research), but it is not representative of this
study's actual population (140 Type 1 children aged 6–15, Coimbatore) and
wasn't extended to be. `scripts/import-content.ts` and
`scripts/seed-quizzes.ts` are the real content path for this product and
intentionally don't touch `prisma/seed.ts` or run through `prisma db seed`.

## What this product actually added

For contrast — everything above is pre-existing platform surface this
product doesn't use. What's new:

- **Schema**: `EducationContent.locale`/`bodySource`/`bodyFormat`/
  `importChecksum`, 4 new `EducationCategory` values, `Quiz` / `QuizQuestion`
  / `QuizOption` / `QuizAttempt` / `QuizResponse`, `TopicProgress` /
  `SyncEvent`, `FeatureFlag`.
- **Services**: locale-aware `education.ts`, `quizzes.ts`, `sync.ts`,
  `progress.ts`, `feature-flags.ts`, and the pure (no-database)
  `lib/quizzes/grading.ts`.
- **Routes**: `/api/education/bundle`, `/api/quizzes*`, `/api/sync*`,
  `/api/progress`, `/api/feature-flags`, `/api/admin/quizzes*`,
  `/api/admin/feature-flags`, `/api/admin/content/preview`,
  `/api/admin/progress`.
- **Admin CMS**: the education create/edit form (Markdown authoring + live
  preview), the quizzes list page, and the feature-flags toggle page — the
  first write-capable pages in the admin dashboard; everything before this
  was read-only.
- **Content**: `scripts/import-content.ts` (docx → Markdown → sanitised HTML,
  with image extraction/resizing) and `scripts/seed-quizzes.ts` (hand-
  transcribed, reviewed quiz content — never heuristically parsed straight
  into the database).

## Governance note, not a code issue

The health-logging endpoints above (`/api/glucose`, `/api/insulin`,
`/api/meals`, …) are live and **PATIENT-writable** even though this
product's v1 has no health-logging UI. Ethics approval for an *education*
study very likely doesn't cover collecting glucose readings. If this
platform is deployed for the study as-is, consider gating that endpoint
family behind a `health_logging_enabled`-style flag defaulting off, or
documenting them as explicitly out of scope with the ethics committee. This
is a scope/consent question, not a bug.
