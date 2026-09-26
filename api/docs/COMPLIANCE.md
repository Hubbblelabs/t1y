# Play Store and privacy compliance — T1D Prajana Yandra

What the app collects, where each Google Play requirement is met, and what
still has to be done by a person before and during the Play Console
submission. Keep this in step with:

- the in-app privacy notice — `app/lib/models/privacy_content.dart`
- the in-app Terms & Conditions — `app/lib/models/terms_content.dart`
- the public privacy policy — `api/app/privacy/page.tsx` (served at `/privacy`)
- the public deletion page — `api/app/account-deletion/page.tsx` (`/account-deletion`)

If any of these change, change the others and re-check the Data safety form.

---

## 1. What the app collects

| Data | Where it comes from | Required? | Stored where |
| --- | --- | --- | --- |
| Parent email address | Sign-up | Yes (sign-in) | `User.email` |
| Password | Sign-up | Yes | `Account.password` — hashed by Better Auth |
| Preferred language | Sign-up chat, language switch | Yes | `User.locale` |
| Child's name, date of birth, sex, year of diagnosis | Sign-up chat | Yes | `Profile` |
| Phone, city, country, treatment, height, weight, doctor, emergency contact, extra study questions | Profile → Details | Optional | `Profile`, `Profile.customFieldValues` |
| Glucose readings (value, time) | Health → Record | Optional | `GlucoseReading` |
| Insulin doses (units, time) | Health → Record | Optional | `InsulinLog` |
| Carbohydrates eaten (grams, time) | Health → Record | Optional | `Meal` |
| Help Book progress, quiz answers and scores, badges | Using the app | Automatic | `TopicProgress`, `QuizAttempt`, badges |
| Help and support messages | Help and support | Optional | `SupportThread` / `SupportMessage` |
| Parent PIN | Settings / Health | Yes, to record health data | `Household.mpinHash` — scrypt hash |

**Not collected:** location, contacts, photos/files, camera, microphone,
advertising ID, device identifiers for tracking. No ads, no analytics or
advertising SDK in the app. Crash reporting (Sentry) is server-side only.

**Device permissions requested:** `INTERNET`; `POST_NOTIFICATIONS` and
`RECEIVE_BOOT_COMPLETED` only for on-device glucose reminders, asked for only
when the parent turns Reminders on in Settings.

## 2. Google Play Data safety form — suggested answers

| Section | Answer |
| --- | --- |
| Does the app collect or share user data? | Collects: yes. Shares: **no** (not transferred to third parties). |
| Encrypted in transit? | Yes (HTTPS only in release builds — see §4). |
| Can users request deletion? | Yes — in the app, and via `/account-deletion`. |
| Personal info | Name; Email address; Phone number; Other info (date of birth, sex, city) — collected, not shared; required (name, email) / optional (phone); purpose: App functionality, Account management. |
| Health and fitness | Health info (glucose, insulin, carbohydrates, diagnosis year, treatment, height, weight) — collected, not shared; optional; purpose: App functionality. |
| Messages | Other in-app messages (Help and support) — collected, not shared; optional; purpose: Developer communications / App functionality. |
| App activity | Other user-generated content / In-app actions (quiz answers, topics read) — collected, not shared; purpose: App functionality. |
| Anything processed ephemerally? | No. |

State in the form (and it is stated in the app and the policy) that the data is
also used for the named research study, and that published research results
are de-identified.

## 3. Requirements and where they are met

| Requirement | Met by |
| --- | --- |
| Privacy policy URL | `https://<api-domain>/privacy` — add in Play Console → App content → Privacy policy. Also shown in the app (Settings → How your data is used) and in the Terms at sign-up. |
| In-app account deletion | Settings → Correct or delete your data → Delete my account (asks for the password). `DELETE /api/users/me` → `deleteOwnAccount()` in `lib/services/users.ts`. Recorded in the audit log as `auth.account_deleted`. |
| Web deletion link | `https://<api-domain>/account-deletion` — add in Play Console → App content → Data deletion. |
| What deletion removes / keeps | Removes identifiers, contact details, extra answers, support messages, devices, sign-in. Keeps glucose, insulin, carbohydrate and quiz records de-identified (participant code only) as research data. Disclosed in the app, the terms, the policy and the deletion page. |
| Consent before collection | Sign-up cannot finish without opening the Terms and ticking "I agree" (`terms_screen.dart`). |
| Users can see and correct their data | Settings → Details → Edit / Save / Cancel. |
| Notification permission asked in context | Settings → Reminders: an explanation first, then the phone's own prompt; declined → "Open settings". |
| Health information presented responsibly | Terms §1: not a medical device, no diagnosis or dosing; no dose calculation anywhere in the app (calculators run only by staff in the dashboard). Insulin/carb screens say they only record. |
| Sensitive credentials | Passwords hashed (Better Auth, scrypt); PIN hashed (scrypt); bearer token in `flutter_secure_storage`; `android:allowBackup="false"` so tokens are not copied into device backups. |
| Staff access to health data | Every view of a participant's record is audited (`lib/audit/audit.ts`). |

## 4. Release build checklist (app)

1. **HTTPS backend.** Release builds do not allow plain HTTP (the exception is
   only in `android/app/src/debug` and `profile` manifests). Build with the real
   address:
   ```
   flutter build appbundle --release --dart-define=API_BASE_URL=https://<api-domain>
   ```
   Without the define, the build points at the development laptop and will not
   work for anyone.
2. **Signing.** `android/key.properties` + the upload keystore must exist on the
   build machine (see `android/app/build.gradle.kts`). Enrol in Play App Signing.
3. **Version.** Bump `version:` in `app/pubspec.yaml` for every upload
   (`1.0.0+1` → `1.0.1+2` …); Play rejects a repeated version code.
4. **Target SDK.** Uses Flutter's default `targetSdk`; confirm it meets Play's
   current minimum when building (Play Console shows a warning if not).
5. **App name / icon / screenshots / short & full description** in Play Console,
   in English (Tamil listing optional).

## 5. Server checklist

1. Deploy the API on the HTTPS domain used above; set `BETTER_AUTH_URL`,
   `BETTER_AUTH_SECRET`, `DATABASE_URL`, `CRON_SECRET`.
2. Run migrations: `npx prisma migrate deploy`.
3. **Turn on `health_logging_enabled`** in the dashboard (Feature flags) — it is
   off by default, and glucose/insulin/carbohydrate recording is refused while
   it is off. Confirm the study's ethics approval covers health-data
   collection before switching it on (the flag's own notice says the same).
4. `carb_logging_enabled` is on by default; switch it off in Feature flags to
   hide the carbohydrate log for everyone.
5. Glucose entry cooldown defaults to **1 hour** (Settings → Glucose entry).
6. Existing family accounts created before this release:
   `npx tsx scripts/activate-family-accounts.ts` (marks them active and
   verified — families no longer verify an email or wait for approval).

## 6. Target audience and Families policy

The app is used by **parents and guardians** of children aged 6–15; the
account holder is the adult. In Play Console → Target audience, choose adult
age groups (18+) and answer that the app is not directed at children, with the
note that it is used by parents about their child's care. If Google classifies
it as appealing to children anyway, the Families policy applies: no ads (true),
no third-party SDKs that collect data from children (true), and a privacy
policy (present).

## 7. Health apps declaration

Play Console → App content → Health apps: declare it as a health/medical
education and tracking app used in a clinical research study. It is **not** a
medical device, does not diagnose, and does not calculate doses for users.

## 8. Commitments the study team must keep

These are promised in the policy and deletion page; they are processes, not
code:

- Deletion requests received **outside** the app (e.g. at the clinic) are
  completed **within 30 days** — in the dashboard, set the participant
  inactive and remove their details, or run the same deletion as the app.
- De-identified research data is retained only as long as the ethics approval
  allows.
- The Tamil versions of the terms and privacy notice are reviewed by a Tamil
  speaker on the study team before release.
- A contact route exists: the study coordinator, and Help and support in the app.
  Consider adding a public email address to `/privacy` and `/account-deletion`
  — Play reviewers prefer one.
