# Participant features

Which app features one child is enrolled for — set by a coordinator when the
participant is created, and editable afterwards from the participant's page.

This is separate from `FeatureFlag` (`lib/services/feature-flags.ts`), which
switches something on or off for the whole study. This list narrows that
further: within a study that *does* offer health logging, one family might
only be asked to log glucose, another glucose and insulin, and so on.

## The features

| Key | What it gates |
|---|---|
| `GLUCOSE_LOGGING` | Recording a glucose reading (`POST /api/glucose`) |
| `INSULIN_LOGGING` | Recording an insulin dose (`POST /api/insulin`) |
| `CARB_LOGGING` | Recording carbohydrates eaten (`POST /api/meals`) |
| `HELP_BOOK` | Not yet enforced server-side; carried for the app to read |
| `QUIZZES` | Not yet enforced server-side; carried for the app to read |
| `HELP_SUPPORT` | Not yet enforced server-side; carried for the app to read |

Every account defaults to all six. `lib/participant-feature-registry.ts` is
the closed list of valid keys, shared between the server (which also enforces
it) and the admin dashboard's forms (which only need the labels).

## Enforcement

`lib/services/participant-features.ts`'s `assertFeatureEnabled(userId, key)`
is called from the three write routes above before a record is created, and
throws a plain `ForbiddenError` naming the feature. The phone is expected to
hide the matching entry screen too (see `lib/services/participant_features.dart`
and `HomeTab`/`HealthHubScreen` in the Flutter app), but that is a courtesy —
the server call is what actually stops the write.

`HELP_BOOK`, `QUIZZES` and `HELP_SUPPORT` are stored and returned to the app
but nothing currently reads them to hide those tabs; only the three
health-data features are wired end to end.

## Where things are

- Registry: `lib/participant-feature-registry.ts`
- Enforcement: `lib/services/participant-features.ts`
- Set at creation: `components/admin/participants/participant-form.tsx`
- Changed later: `components/admin/participants/participant-features-control.tsx`
- Read on the phone: `app/lib/services/participant_features.dart`
- Tests: `tests/integration/calculator-run-and-participant-features.test.ts`

## Health data configuration

Within glucose, insulin and exercise, a coordinator also chooses *what* each
family is asked to record (**Participants → Health data configuration**, for
one participant on their page or for many from the table checkboxes — the bulk
editor shows a review step and overwrites each selected participant's earlier
settings).

| Setting (`Profile`) | Meaning |
|---|---|
| `glucoseSlots` | Which of pre/post breakfast, lunch, dinner the app asks for. Default: all six. Empty: no glucose entry. |
| `insulinIntervalHours` | 24 = once a day, 12 = twice a day, 4 = every 4 hours. null = no reminder. |
| `exerciseEnabled`, `exerciseReminderHours` | Whether exercise is asked for, and the reminder gap. |

Enforcement: `POST /api/glucose` rejects a `slot` the child is not enrolled
for (and applies the entry cooldown per slot); `POST /api/exercises` requires
`exerciseEnabled`. Reminders are local to the phone: on every app open and
refresh `HealthAccess.load` re-reads the numbers from `/api/users/me` and
re-schedules the next 48 hours of insulin/exercise notifications, so a change
in the dashboard takes effect the next time the app opens.

The carbohydrate entry also takes an optional free-text description of the food
(stored in `Meal.name`, at most 200 characters, validated by the API).

Files: `lib/health-data-config.ts`, `app/api/admin/participants/health-config`,
`components/admin/participants/{health-config-editor,participant-selection,participant-health-config-control}.tsx`,
app `models/health_config.dart`, `services/{health_access,local_reminders}.dart`.
