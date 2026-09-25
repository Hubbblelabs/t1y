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
