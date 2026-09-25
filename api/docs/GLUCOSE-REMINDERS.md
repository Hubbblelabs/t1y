# Glucose logging reminders

A participant enrolled for `GLUCOSE_LOGGING` who has gone 6 hours without a
reading gets a push notification, and staff can see the same gap from the
dashboard.

## How it works

`lib/services/glucose-reminders.ts`:

- `listGlucoseLoggingStatus()` — every active, glucose-eligible participant,
  with hours since their last reading (`null` if never) and whether that
  makes them overdue (≥ 6 hours, or no reading at all).
- `sendGlucoseReminders()` — creates a `GLUCOSE_REMINDER` notification for
  each overdue participant who was not already reminded in the last 6 hours
  (checked from the notification table itself, so nothing extra is kept in
  sync). Runs only while the `health_logging_enabled` flag is on.

`/api/cron/glucose-reminders` calls `sendGlucoseReminders()` on the hour
(`vercel.json`), the same cadence as the existing `/api/cron/reminders` job.
It is a separate job because this one is computed fresh from what has
actually been recorded, not from a stored per-family schedule.

## Where staff see it

The admin's **Health data → Glucose** page shows a "Glucose logging" panel
above the readings table: how many eligible children are overdue, and who,
linking to each one's participant page. This is the same 6-hour threshold the
reminder itself uses, so it never disagrees with what a family was told.

## Where things are

- Service: `lib/services/glucose-reminders.ts`
- Cron: `app/api/cron/glucose-reminders/route.ts`
- Admin panel: `components/admin/health/glucose-logging-status.tsx`
- Tests: `tests/integration/calculator-run-and-participant-features.test.ts`
