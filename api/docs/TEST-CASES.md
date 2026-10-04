# Test cases — app, admin dashboard and backend

Marked-up checklist of what must be verified before a release. Nothing here is
automated by being written down; the **Layer** column says where each case
should live so the list can be turned into tests one area at a time.

- Written from a read of the code as it stands (Flutter app, Next.js admin +
  API, Prisma schema). Where an older feature's exact wording or limit is not
  certain, the case says **verify** — confirm against the running app and fix
  the case, not the other way round.
- **Status** boxes: `☐` not run · `✔` passed · `✘` failed (note the bug id) ·
  `–` not applicable.
- Tamil: every user-visible case is run in **both English and Tamil** unless it
  says otherwise (section 13 holds the Tamil-specific ones).

---

## 0. Tooling — the primary choice first, alternatives second

| Layer | **Primary (use this)** | Alternative (only if the primary hurts) |
|---|---|---|
| Backend unit | **Vitest** — already in `api/tests/unit` (184 tests today) | Jest (no advantage; skip) |
| Backend integration (API ↔ DB) | **Vitest + a *separate* Postgres** — `RUN_INTEGRATION_TESTS=1`; `docker-compose.dev.yml` already exists. **Never point at the hosted Neon database.** | A Neon *branch* per CI run (copy-on-write, fast); Testcontainers |
| Admin dashboard e2e | **Playwright** — `api/tests/e2e/admin.spec.ts` exists | Cypress |
| Flutter unit + widget | **`flutter_test`** — 15 files in `app/test` | `mocktail` for fakes (add if a service needs mocking) |
| Flutter on a real device | **Manual on a low-end Android phone + one iPhone** using section 15, then a recorded **Maestro** flow for the smoke path | `integration_test` (heavier setup), Patrol |
| API contract (app ↔ server) | **Vitest integration tests that call the real route handlers** (`tests/integration/app-wiring.test.ts` is the pattern) | Schemathesis / OpenAPI fuzzing |
| Load (≈140 users) | **k6** — one script: login → home → record glucose, 50 virtual users | Artillery |
| Accessibility | **axe** inside Playwright for the admin; **TalkBack** pass by hand for the app | Lighthouse |
| Security | **`npm audit` / `flutter pub outdated`** each release + the section 12 cases by hand | OWASP ZAP baseline scan against a staging URL |
| Time | **Fake clock** (`vi.useFakeTimers`, Flutter `FakeAsync`) for every expiry/cooldown/“a day later” case | — |

Test data: use `docs/TEST-CREDENTIALS.md` / `prisma/seed.ts` on the test
database only. Each case that needs “a child who …” names the setup in its
Steps column.

**Priorities:** **P0** = release blocker (data loss, wrong data, security,
cannot sign in) · **P1** = core flow broken or confusing · **P2** = polish and
rare edges.

---

## 1. Accounts, sign-up and sign-in

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| AUTH-01 | New email on the entry screen | `check-email` says unknown → app starts sign-up chat | W, I | P0 | ☐ |
| AUTH-02 | Existing ACTIVE email on entry screen | Asks for password, not sign-up | W, I | P0 | ☐ |
| AUTH-03 | Existing **PENDING** email | Goes straight to “enrolment still being reviewed”, never asks for a password | W, I | P0 | ☐ |
| AUTH-04 | Invalid email formats (`a@`, `a b@c.com`, empty, 300 chars) | Rejected with a field message; no request sent for obviously bad input | U, W | P1 | ☐ |
| AUTH-05 | Email case/space normalisation (`  Foo@Mail.COM `) | Treated as the same account as `foo@mail.com` | U, I | P0 | ☐ |
| AUTH-06 | Complete sign-up chat with all required questions | Account created as **PENDING**; “awaiting approval” screen | I, M | P0 | ☐ |
| AUTH-07 | Skip an optional signup question | Accepted; answer stored as empty, not as the string “skip” | W | P2 | ☐ |
| AUTH-08 | Answer fails the question’s rule (e.g. diagnosis year in the future, DOB too old) | Inline rejection using the admin-defined rule; chat does not advance | U, W | P1 | ☐ |
| AUTH-09 | Password rules (length, common passwords) at sign-up | Rejected with the same rule the server enforces | U, I | P0 | ☐ |
| AUTH-10 | Sign up with an email that already exists | Clear “already registered” message, no duplicate row | I | P0 | ☐ |
| AUTH-11 | Sign-in while PENDING | Refused with the “yet to be updated by the admin” message (Tamil too) | I, W | P0 | ☐ |
| AUTH-12 | Admin activates a PENDING participant | Temporary password issued once; account ACTIVE; `mustChangePassword` set | I | P0 | ☐ |
| AUTH-13 | First sign-in with a temporary password | Forced to the change-password screen before anything else | W, M | P0 | ☐ |
| AUTH-14 | Change password: wrong current / weak new / same as old | Each rejected with its own message | U, I | P1 | ☐ |
| AUTH-15 | Sign-in, wrong password ×N | Generic “email or password is wrong”; rate-limited after the limit; no hint whether the email exists | I | P0 | ☐ |
| AUTH-16 | Sign-in as SUSPENDED / INACTIVE | Refused with an account-state message | I | P0 | ☐ |
| AUTH-17 | Session survives app restart (cold start) | Lands on Home without signing in again | M | P0 | ☐ |
| AUTH-18 | Sign out | Token cleared, local reminders cancelled, PIN session cleared, back to Get Started | W, M | P0 | ☐ |
| AUTH-19 | Token expired/revoked while using the app | Next call returns 401 → app returns to sign-in without a crash or a blank screen | I, M | P0 | ☐ |
| AUTH-20 | Delete own account (Profile → Settings → Correct or delete data) | Personal fields scrubbed, participant code retained for study record, sign-in no longer possible | I, M | P0 | ☐ |
| AUTH-21 | Anonymous user calls any authenticated API route | 401 with the standard error envelope, for **every** route (table-driven test over the route list) | I | P0 | ☐ |

### 1a. Households, children and the parent PIN (MPIN)

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| HH-01 | Parent adds a second child | New child created **PENDING**; appears in the picker marked “awaiting approval”; cannot be selected | I, W | P0 | ☐ |
| HH-02 | Select a child; all health screens | Every request after selecting acts on that child only (glucose list, insulin, SOS, gallery) | I, M | P0 | ☐ |
| HH-03 | Switch child | Home, Health, reminders and cached SOS list reload for the new child; nothing from the previous child remains on screen | M | P0 | ☐ |
| HH-04 | Child A’s token reads child B’s record id (`GET /api/glucose/:id`) | 403/404 — never the data | I | P0 | ☐ |
| MP-01 | Health screens before any PIN is set | Asked to create a PIN first | W | P1 | ☐ |
| MP-02 | Set PIN with 4 identical digits / sequential digits | Behaves as the validation schema specifies (verify) | U | P2 | ☐ |
| MP-03 | `POST /api/mpin` when a PIN already exists | Refused — change only via `/mpin/reset` with the account password | I | P0 | ☐ |
| MP-04 | Wrong PIN ×N | Locked for the lock period; status reports locked; correct PIN during lock still refused | I | P0 | ☐ |
| MP-05 | PIN unlock lasts 10 minutes idle | After 10 min idle the next health screen asks again; app restart asks again | W, M | P1 | ☐ |
| MP-06 | Reset PIN with correct / wrong account password | Correct resets; wrong refuses and counts toward rate limit | I | P0 | ☐ |
| MP-07 | SOS screen and Home are reachable **without** the PIN | No PIN prompt on SOS | W | P0 | ☐ |

---

## 2. Glucose

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| GLU-01 | Record 142 mg/dL | Saved; appears in recent list and Home; “last reading” resets | I, W | P0 | ☐ |
| GLU-02 | Boundaries 9.9 / 10 / 1000 / 1000.1 | Rejected / accepted / accepted / rejected, both in app and API | U, I | P0 | ☐ |
| GLU-03 | Non-numeric, empty, `1e3`, `--5`, comma decimal `142,5` | Rejected or parsed exactly as the field rules say; never saved as `NaN` | U, W | P0 | ☐ |
| GLU-04 | Second unslotted reading inside the cooldown hour | Refused with the “next reading can be entered at …” message | I | P0 | ☐ |
| GLU-05 | Change cooldown setting in admin (1 → 0 / 2 h) | New value enforced immediately | I | P1 | ☐ |
| GLU-06 | Slot reading for a **disabled** slot (API called directly) | 403 naming the slot | I | P0 | ☐ |
| GLU-07 | Same slot twice within cooldown | Second refused; **different** slot a minute later accepted | I | P0 | ☐ |
| GLU-08 | Slot reading stores context PRE_MEAL/POST_MEAL correctly | Pre-* → PRE_MEAL, Post-* → POST_MEAL | U, I | P1 | ☐ |
| GLU-09 | Glucose with `GLUCOSE_LOGGING` off for the child | 403; app hides the entry | I, W | P0 | ☐ |
| GLU-10 | `health_logging_enabled` flag off | Every health write refused; app shows the “not enabled” message, no crash | I, W | P0 | ☐ |
| GLU-11 | Trend/units: mmol/L reading via API | Converted correctly in aggregates; app only ever shows mg/dL | U, I | P1 | ☐ |
| GLU-12 | Readings list pagination and date filter (`range=custom`, bare `from/to`) | Correct page counts; bare from/to without `range=custom` is a validation error | I | P1 | ☐ |
| GLU-13 | Offline: save a reading with no network | Clear failure message; nothing silently queued as saved; no duplicate when retried | M | P0 | ☐ |
| GLU-14 | Double-tap Save | Exactly one record | W, I | P0 | ☐ |
| GLU-15 | Local 6-hour reminder rescheduled after each reading | Next reminder = last reading + 6 h; a new reading replaces it; none when Reminders are off | U, M | P1 | ☐ |
| GLU-16 | Server cron `glucose-reminders` | Only overdue, glucose-enrolled, ACTIVE children; not twice within 6 h | I | P1 | ☐ |

## 3. Insulin, carbohydrates, exercise

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| INS-01 | Record 4 units; bounds 0.09 / 0.1 / 300 / 300.1 | Rejected / accepted / accepted / rejected | U, I | P0 | ☐ |
| INS-02 | Backdate a dose via “choose a time” | Saved at that time; cannot pick a future time (clamped to now) | W | P1 | ☐ |
| INS-03 | Insulin when `INSULIN_LOGGING` off | 403; tile hidden | I, W | P0 | ☐ |
| INS-04 | Today’s total counts only today’s doses (local midnight) | Correct across midnight and timezone | U | P1 | ☐ |
| CARB-01 | Record 45 g; bounds 0.09 / 0.1 / 500 / 500.1 | Rejected / accepted / accepted / rejected (app limit 500; API accepts ≤2000 — **verify the app limit is the intended one**) | U, I | P1 | ☐ |
| CARB-02 | Food description “2 dosa” | Saved in the meal name; shown back | I | P1 | ☐ |
| CARB-03 | Description of exactly 200 / 201 characters | Accepted / refused (API) and the field stops at 200 in the app | U, I, W | P0 | ☐ |
| CARB-04 | Description with Tamil text, emoji, newline, only spaces | Stored intact; spaces-only is treated as empty | U, I | P1 | ☐ |
| CARB-05 | Carbohydrates with study flag `carb_logging_enabled` off or `CARB_LOGGING` off | 403; tab hidden | I, W | P0 | ☐ |
| EXE-01 | Exercise 30 min; bounds 0 / 1 / 1440 / 1441; decimal | Rejected / accepted / accepted / rejected / digits-only field | U, I, W | P0 | ☐ |
| EXE-02 | Exercise tab shown only when `exerciseEnabled` | Hidden otherwise; API refuses | I, W | P0 | ☐ |
| REC-01 | **Double-check pop-up** appears before **every** save (glucose, insulin, carbs, exercise) | Shows slot + value (+ food text); “Go back and edit” saves nothing; “Yes, it’s correct” saves | W | P0 | ☐ |
| REC-02 | Double-check shows exactly what will be saved (e.g. `142,5` → 142.5; exercise rounded to whole minutes) | Dialog value = stored value | W | P0 | ☐ |
| REC-03 | Back button / tapping outside the dialog | Treated as “edit”; nothing saved | W | P1 | ☐ |
| REC-04 | Recent list shows “by <name>” for guardian-entered rows only | Parent-entered rows show nothing extra | W | P1 | ☐ |
| REC-05 | Record screen with several kinds enabled | Picker lists only enabled kinds; opening from a tile opens that kind | W | P1 | ☐ |

---

## 4. Health data configuration (admin) and its effect in the app

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| CFG-01 | Single participant: enable only Pre-breakfast + Post-dinner | App glucose chips show exactly those two | I, W, M | P0 | ☐ |
| CFG-02 | Disable all glucose slots | Glucose entry absent; Health shows what else is on | I, W | P0 | ☐ |
| CFG-03 | New participant defaults | All six slots on, no reminders, exercise off | I | P1 | ☐ |
| CFG-04 | Bulk: select 3 rows → Health data configuration → set → **Review** → Confirm | Review lists the settings and the overwrite warning; Confirm updates all 3; success notice with the count | E, I | P0 | ☐ |
| CFG-05 | Bulk: cancel/close at the review step | Nothing changed | E | P0 | ☐ |
| CFG-06 | Bulk overwrites previous settings fully (not merged) | A previously enabled slot not in the new set is now off | I | P0 | ☐ |
| CFG-07 | Select-all box selects only the current page; changing page clears the selection | No hidden rows in a bulk update | E | P0 | ☐ |
| CFG-08 | Bulk includes an id that is not a PATIENT / doesn’t exist | Reported in `skipped`; others applied | I | P1 | ☐ |
| CFG-09 | Bulk with exercise off but a reminder hour set | Reminder stored as null | U, I | P1 | ☐ |
| CFG-10 | Hours validation: 0, 25, 1.5, negative, 24 | Rejected / rejected / rejected / rejected / accepted | U | P0 | ☐ |
| CFG-11 | User without `PARTICIPANTS_EDIT` | No checkboxes/button; API 403 | E, I | P0 | ☐ |
| CFG-12 | Audit log row written for single and bulk edits (no personal values) | Present, with count and config | I | P1 | ☐ |
| CFG-13 | App picks up a change on next open/refresh (not before) | After Health refresh the chips/tabs change | M | P0 | ☐ |
| CFG-14 | Insulin interval 4 h → reminders scheduled | Notifications at +4 h, +8 h … for the next 48 h; none when Reminders are off | M | P0 | ☐ |
| CFG-15 | Interval changed 4 h → 12 h | Old 4-hour notifications are cancelled, only 12-hour ones remain | M | P0 | ☐ |
| CFG-16 | Interval cleared | All insulin reminders cancelled | M | P0 | ☐ |
| CFG-17 | Reminders re-set on app **resume**, not just cold start | Verified by changing the value in admin then resuming | M | P1 | ☐ |
| CFG-18 | Device reboot / app killed | Already-scheduled notifications still fire (inexact alarm); verify on Android 13+ with the notification permission denied (nothing scheduled, no crash) | M | P1 | ☐ |
| CFG-19 | Offline at app open | Last known configuration used; app does not hide everything | M | P1 | ☐ |

---

## 5. Guardian links (parent away from the child)

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| GRD-01 | Parent creates a link (behind PIN) with 30 min … 24 h | Link + 6-digit code shown; **two** separate share actions | W, I | P0 | ☐ |
| GRD-02 | Expiry below 15 min / above 24 h via API | Rejected | I | P0 | ☐ |
| GRD-03 | Creating a second link | First active link becomes REVOKED; only one ACTIVE | I | P0 | ☐ |
| GRD-04 | Open link, wrong code | “Not right, N attempts left”; counter increments | I | P0 | ☐ |
| GRD-05 | 5th wrong code | Link LOCKED; correct code now also refused; parent sees status Locked | I | P0 | ☐ |
| GRD-06 | Correct code (including leading zeros, e.g. `048213`) | Form opens | I, E | P0 | ☐ |
| GRD-07 | Form shows **only the next due glucose slot** (morning done → afternoon) | Slot = first enabled slot with no reading today in the **child’s timezone** | I | P0 | ☐ |
| GRD-08 | All enabled slots done today | No glucose field; other fields shown; if nothing at all → “Nothing is due” | I, E | P1 | ☐ |
| GRD-09 | Insulin / carbs / exercise fields follow the child’s enrolment and flags | Hidden when off | I | P0 | ☐ |
| GRD-10 | Name empty / 1 char / 81 chars | Rejected | U, E | P0 | ☐ |
| GRD-11 | No values entered | “Enter at least one reading” | U, E | P0 | ☐ |
| GRD-12 | Out-of-range values (glucose 5, insulin 500, exercise 1.5) | Rejected client- and server-side | U | P0 | ☐ |
| GRD-13 | **Double-check pop-up** on the guardian page lists every value + name; “Go back” saves nothing | As REC-01 | E | P0 | ☐ |
| GRD-14 | Submit success | Records created with `enteredBy` = name; link USED; page says expired | I, E | P0 | ☐ |
| GRD-15 | Open the same link again / resubmit | “Already used” | I | P0 | ☐ |
| GRD-16 | Two simultaneous submits | Exactly one set of records; the other refused | I | P0 | ☐ |
| GRD-17 | Submit after expiry / after parent cancelled | Refused with the specific message; nothing written | I | P0 | ☐ |
| GRD-18 | Submit with a slot that is no longer the due one (parent also entered it meanwhile) | Refused “not the one due now”; nothing written, link **not** spent | I | P0 | ☐ |
| GRD-19 | Transaction atomicity: one entry invalid → none saved, link still ACTIVE | All-or-nothing | I | P0 | ☐ |
| GRD-20 | Parent notified in the app after use (open, resume, Health refresh) | One dialog per used link, never repeated | W, M | P0 | ☐ |
| GRD-21 | Notification body contains no health values | Name + “link has expired” only | I | P0 | ☐ |
| GRD-22 | Entries labelled “by <name>” in the app and **“Guardian: <name>”** in admin Glucose/Insulin/Meals/Exercise | Parent rows show “Parent” | I, E | P1 | ☐ |
| GRD-23 | Parent cancels an ACTIVE link | Link dead immediately; code no longer returned by the list API | I, W | P0 | ☐ |
| GRD-24 | Unknown/garbled token | Generic “link can’t be used”; no hint about existence | I | P0 | ☐ |
| GRD-25 | Code is never present in any request body (inspect network) — only a proof (HMAC) | Verified in devtools | M | P0 | ☐ |
| GRD-26 | Ciphertext tamper (flip a byte) / wrong nonce / nonce older than 30 min | Rejected; counts as a failed attempt where appropriate | U, I | P0 | ☐ |
| GRD-27 | Token stored hashed; code stored encrypted (inspect DB) | No plaintext token/code in DB, logs or error reports | I, M | P0 | ☐ |
| GRD-28 | Page: no-index, no-referrer headers; works on a basic Android Chrome and iOS Safari; Tamil toggle | Pass | M | P1 | ☐ |
| GRD-29 | Guardian page over plain HTTP (non-localhost) | Encryption unavailable → clear failure, never a silent plaintext send | M | P1 | ☐ |
| GRD-30 | Rate limit on the three public routes | 429 after the anonymous limit | I | P1 | ☐ |
| GRD-31 | Child’s data is never shown on the page before the code is accepted | Challenge response contains only salt/nonce/expiry | I | P0 | ☐ |

---

## 6. SOS contacts

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| SOS-01 | Admin adds contact (name, phone, free-text tag) | Appears in list with tag badge | E, I | P0 | ☐ |
| SOS-02 | Phone formats: `+91 98765 43210`, `108`, `(044) 2345-6789` | Accepted; `abc`, `12`, 21+ chars, `++91…` rejected | U | P0 | ☐ |
| SOS-03 | Tag free text (Tamil, 41 chars, empty) | Tamil accepted; 41 / empty rejected | U | P1 | ☐ |
| SOS-04 | “Every child” on | Visible to all children, including ones enrolled later | I | P0 | ☐ |
| SOS-05 | Specific children | Visible only to the chosen children; others never receive it from `/api/sos-contacts` | I | P0 | ☐ |
| SOS-06 | Switching Every child → specific list → none selected | Visible to nobody (not silently everyone) | I | P0 | ☐ |
| SOS-07 | Hidden (inactive) contact | Gone from the app on next refresh | I | P0 | ☐ |
| SOS-08 | Edit phone number | App shows the new number after refresh; **old cached number is replaced**, not shown beside it | I, M | P0 | ☐ |
| SOS-09 | Delete contact | Gone; assignments removed | I | P1 | ☐ |
| SOS-10 | Home SOS button and Profile SOS button open the same screen | Yes, both | W | P0 | ☐ |
| SOS-11 | Tap call | Phone dialler opens with the number (spaces/dashes stripped, `+` kept) | M | P0 | ☐ |
| SOS-12 | Device without telephony (tablet/emulator) | Friendly message with the number; no crash | W, M | P1 | ☐ |
| SOS-13 | Offline | Last loaded list shown immediately | W, M | P0 | ☐ |
| SOS-14 | No contacts for this child | Explains to ask the coordinator | W | P1 | ☐ |
| SOS-15 | 60 contacts | List scrolls; order = admin order | W | P2 | ☐ |
| SOS-16 | Non-admin cannot call admin SOS endpoints | 403 | I | P0 | ☐ |
| SOS-17 | Android 11+ / iOS: tel scheme queries declared | Dial works on a release build (manifest `queries`, Info.plist) | M | P0 | ☐ |

---

## 7. Gallery

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| GAL-01 | Admin adds a picture with title | Appears in admin grid and app Gallery | E, I, M | P0 | ☐ |
| GAL-02 | Admin adds a video (+ optional cover) | Admin shows a play badge; app opens a player | E, M | P0 | ☐ |
| GAL-03 | Switching Picture ⇄ Video clears the previous file | Yes | W/E | P2 | ☐ |
| GAL-04 | Save with no file | Save disabled | E | P1 | ☐ |
| GAL-05 | Hide an item | Gone from the app; still listed (Hidden) in admin | I | P0 | ☐ |
| GAL-06 | Tamil title/caption present vs absent | Tamil shown in Tamil mode; English fallback when absent | U, M | P1 | ☐ |
| GAL-07 | Delete an item | Removed from admin and app | I | P1 | ☐ |
| GAL-08 | Image fails to load (broken URL) | Placeholder, no crash | W | P1 | ☐ |
| GAL-09 | Video: play, pause, scrub, rotate, leave screen mid-play | Audio stops when leaving; controller disposed | M | P0 | ☐ |
| GAL-10 | Large image zoom (pinch) | Works; no memory spike crash on a low-end phone | M | P1 | ☐ |
| GAL-11 | Empty gallery / offline | Empty or “could not reach” message | W | P1 | ☐ |
| GAL-12 | Non-HTTP(S) URL via API (`javascript:`, `file:`) | Rejected | U, I | P0 | ☐ |
| GAL-13 | Non-admin cannot write | 403 | I | P0 | ☐ |

---

## 8. Progress graph (Home, below the calendar)

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| PRG-01 | Brand-new account, no readings | No graph | W | P0 | ☐ |
| PRG-02 | First reading **today** only | No graph | W | P0 | ☐ |
| PRG-03 | First reading yesterday, none since | Still hidden (needs ≥ 2 days with readings) | W | P0 | ☐ |
| PRG-04 | Readings on two different days, first before today | Graph appears | W, M | P0 | ☐ |
| PRG-05 | Midnight rollover: reading today at 23:50, opened 00:10 | Graph appears after midnight (fake clock) | W | P1 | ☐ |
| PRG-06 | Start vs Lately values = weighted average of the first / last `window` days (window = min(7, days÷2)) | Matches a hand calculation on a fixture | U | P0 | ☐ |
| PRG-07 | Verdict: moving closer / staying / not yet | Correct for fixtures: 220→170, 120→130, 120→210 | U | P0 | ☐ |
| PRG-08 | > 60 days of data | Condensed to weekly averages; labels still correct | U | P1 | ☐ |
| PRG-09 | Y-axis range always includes the 70–180 band and every value | Even for all-low or all-high data | U | P1 | ☐ |
| PRG-10 | Touch/drag moves the marker; bubble stays inside the card | Yes | W, M | P1 | ☐ |
| PRG-11 | Add a reading, pull to refresh | Graph reloads with the new day/value | M | P0 | ☐ |
| PRG-12 | Trends call fails / times out | Card hidden, rest of Home intact | W | P0 | ☐ |
| PRG-13 | Tamil: month names, labels, note | Tamil, no overflow | M | P1 | ☐ |
| PRG-14 | Text-scale 200% and smallest phone | No overflow/clipping | M | P1 | ☐ |
| PRG-15 | Copy never gives advice (“targets differ…” note present, no “you should”) | Pass | M | P0 | ☐ |

---

## 9. Learning content, quizzes, rewards, support

(Older features — confirm exact limits and wording against the running build.)

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| EDU-01 | Help Book list in English and Tamil | Same topics; Tamil titles; missing Tamil falls back clearly | W, I | P0 | ☐ |
| EDU-02 | Open a topic, scroll to end | Marked read; progress count updates; “continue reading” card points at it | I, W | P0 | ☐ |
| EDU-03 | Topic with image and video blocks | Image fallback used when missing; video never autoplays with sound | M | P1 | ☐ |
| EDU-04 | Offline after one sync | Previously synced topics readable; offline banner shown | M | P0 | ☐ |
| EDU-05 | Admin edits a topic, publishes | App shows the new text after next sync (≤ 1 day stale rule or refresh) | I, M | P0 | ☐ |
| EDU-06 | Draft/hidden topics never reach the app | API omits them | I | P0 | ☐ |
| QUZ-01 | Take a quiz, all answers right / all wrong / partial | Score and pass state per the grading rules (`quiz-grading` unit tests) | U, W | P0 | ☐ |
| QUZ-02 | Quiz in Tamil vs English | Same questions; correct option identical across languages | I | P0 | ☐ |
| QUZ-03 | Retake | Allowed/blocked as specified; latest vs best score rule (verify) | I | P1 | ☐ |
| QUZ-04 | Leave mid-quiz | No partial result saved as complete | W | P1 | ☐ |
| RWD-01 | Badge earned (e.g. first topic read, first quiz passed) | Appears once, with animation; not re-awarded | I, W | P1 | ☐ |
| SUP-01 | Ask a question (empty / 1 char / max length) | Validation; sent; appears in thread | W, I | P0 | ☐ |
| SUP-02 | Admin replies | Parent sees unread-answer indicator on Home; opens thread; indicator clears | I, M | P0 | ☐ |
| SUP-03 | A parent can see only their own threads | Other households’ ids → 404 | I | P0 | ☐ |

---

## 10. Language, text size, offline and sync

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| LANG-01 | Switch English → Tamil → English anywhere | Whole UI switches without restart; choice survives cold start and is saved to the account | W, M | P0 | ☐ |
| LANG-02 | **Tamil text is the same size as English** (no per-language scaling; only the device font-size setting applies) — on Android *and* iPhone | Compare the same screen in both languages | M, W | P0 | ☐ |
| LANG-03 | Tamil on a phone with large system font | No clipped text on Home, Record, Guardian share, SOS | M | P0 | ☐ |
| LANG-04 | Every new string exists in both languages (language audit test) | `language_audit_test` passes; add the new keys | U | P0 | ☐ |
| LANG-05 | Server error messages shown in Tamil when known | Translated or a Tamil generic line — never raw English | U, M | P1 | ☐ |
| OFF-01 | Airplane mode on Home | Offline banner; cached content visible; no endless spinner (12 s guard) | M | P0 | ☐ |
| OFF-02 | Come back online | Banner clears; pending progress events flushed once, no duplicates | M | P0 | ☐ |
| OFF-03 | Background sync only when local copy > 1 day old | Not on every resume | U | P2 | ☐ |
| OFF-04 | Slow network (3G throttle) | Screens show what loaded; no spinner lock | M | P1 | ☐ |

---

## 11. Admin dashboard

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| ADM-01 | Sign-in, wrong password, lockout, sign-out, session timeout | As AUTH cases for staff; redirected to login when the cookie is missing | E | P0 | ☐ |
| ADM-02 | Enrol one participant | Created PENDING; appears in the list; duplicate email refused | E, I | P0 | ☐ |
| ADM-03 | Bulk import: good file / bad rows / duplicates / >1000 rows / empty / wrong type | Per-row report; good rows created; limits respected | I, E | P0 | ☐ |
| ADM-04 | Activate → temp password shown once | Cannot be retrieved again | E, I | P0 | ☐ |
| ADM-05 | Change status (suspend/inactive/active) | Reflected in the app’s next sign-in | E, I | P0 | ☐ |
| ADM-06 | Participant filters, search, sort, pagination (URL-driven) | Correct and shareable URLs; empty state wording | E | P1 | ☐ |
| ADM-07 | Participant page: enabled features, health data configuration, profile card, timeline | Save only shown when dirty; saved notice | E | P1 | ☐ |
| ADM-08 | Delete participant | Personal data scrubbed, study code kept; confirm dialog | E, I | P0 | ☐ |
| ADM-09 | Health data browse (Glucose/Insulin/Carbs/Exercise): date range, search, “Entered by” column, mobile card layout | Correct rows and labels | E | P1 | ☐ |
| ADM-10 | Questions we ask (profile fields): add, order, required, validation rules, Tamil label, show-on-signup | App sign-up chat and profile reflect it | E, I | P0 | ☐ |
| ADM-11 | Help Book editor: create, English/Tamil, reorder, publish/unpublish, media | App shows after sync | E, M | P0 | ☐ |
| ADM-12 | Quiz editor: questions, correct answers, Tamil pairing | Grading matches | E, U | P0 | ☐ |
| ADM-13 | SOS contacts and Gallery pages (see 6 and 7) | — | E | P0 | ☐ |
| ADM-14 | Support inbox: reply, status | See SUP-02 | E | P1 | ☐ |
| ADM-15 | Settings: glucose cooldown, feature flags | Takes effect immediately; audited | E, I | P1 | ☐ |
| ADM-16 | Audit log lists who/what/when; never contains health values or passwords | Verified on create/update/delete of each entity | I | P0 | ☐ |
| ADM-17 | Reports / exports: row cap, retention, pseudonymous codes only (no names/emails in research exports) | Pass | I | P0 | ☐ |
| ADM-18 | Admin accounts: promote/demote, capabilities, cannot remove the last admin, cannot edit own role | Pass | I, E | P0 | ☐ |
| ADM-19 | Dark/light theme, mobile width, keyboard-only navigation, axe scan | No critical violations | E | P2 | ☐ |
| ADM-20 | Unsaved-changes and error banners on network failure for every form | Message shown; entered data not lost | E | P1 | ☐ |

---

## 12. Security and privacy

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| SEC-01 | **Authorization matrix**: every route × {anonymous, parent, other parent, admin without capability, admin} | Table-driven; only the intended role succeeds | I | P0 | ☐ |
| SEC-02 | IDOR sweep: swap ids on every `/:id` route (glucose, insulin, meals, exercises, support, guardian-shares, notifications) with another household’s id | 403/404 | I | P0 | ☐ |
| SEC-03 | Mass assignment: send extra fields (`userId`, `role`, `status`, `enteredBy`, `slot` not enabled) to health and profile routes | Ignored or rejected; `enteredBy` can only be set by the guardian flow | I | P0 | ☐ |
| SEC-04 | CSRF: cookie-authenticated POST from an untrusted `Origin` | Refused; public guardian routes are exempt only because they carry their own proof | I | P0 | ☐ |
| SEC-05 | Rate limits on sign-in, check-email, guardian routes, writes | 429 after the documented limits | I | P1 | ☐ |
| SEC-06 | SQL/NoSQL/HTML injection strings in every free-text field (names, tags, captions, food, support text) | Stored inertly; rendered escaped in admin and app | I, E | P0 | ☐ |
| SEC-07 | Secrets: no keys in the Flutter bundle or logs; `.env` not served; Sentry events scrubbed of health values and tokens | Pass | M | P0 | ☐ |
| SEC-08 | TLS only; HSTS; app refuses cleartext API base in release | Pass | M | P0 | ☐ |
| SEC-09 | Password storage hashed; reset tokens single-use and expiring | Pass | I | P0 | ☐ |
| SEC-10 | Health values never in notification bodies or lock-screen previews | Pass (local and server) | I, M | P0 | ☐ |
| SEC-11 | Account deletion really removes personal data (DB spot-check) | Pass | I | P0 | ☐ |
| SEC-12 | Dependency audit (`npm audit`, `flutter pub outdated`) | No unaddressed high/critical | – | P1 | ☐ |
| SEC-13 | Cron endpoints require the cron secret | 401 without it | I | P0 | ☐ |
| SEC-14 | Upload endpoint: type and size limits, signed ticket expiry, no executable types | Pass | I | P0 | ☐ |
| SEC-15 | Data minimisation: the guardian never learns the child’s name, DOB or other data | Page and API responses contain none | I | P0 | ☐ |

---

## 13. Tamil-specific checks (run alongside the above)

| ID | Scenario | Expected | ☐ |
|---|---|---|---|
| TA-01 | Names in Tamil script in sign-up, profile, admin search | Stored, searched and shown correctly; initials on the ID card sensible | ☐ |
| TA-02 | Tamil in carb description, tag, captions, support text | No mojibake in admin tables, exports, audit log | ☐ |
| TA-03 | Line breaks and truncation of long Tamil strings in buttons, chips, dialogs (double-check pop-up, guardian share, SOS) | No clipped glyphs | ☐ |
| TA-04 | Tamil date/month labels (progress graph, guardian share times) | Correct | ☐ |
| TA-05 | Guardian web page Tamil toggle on a low-end Android browser (font availability) | Renders; no tofu boxes | ☐ |

---

## 14. Non-functional

| ID | Scenario | Expected | Tool | Pri | ☐ |
|---|---|---|---|---|---|
| NFR-01 | 140 users, 50 concurrent: sign-in, Home load, record glucose | p95 < 1.5 s; 0 % 5xx | k6 | P1 | ☐ |
| NFR-02 | Home cold start on a low-end Android (≤ 3 GB RAM) | Interactive in a few seconds; no ANR | manual | P1 | ☐ |
| NFR-03 | Participant list with 140 and 1,000 rows | Paged; fast | E | P2 | ☐ |
| NFR-04 | Android 8/10/13/14, small (5") and large screens; iOS latest | No layout breaks | manual | P1 | ☐ |
| NFR-05 | Upgrade path: install previous build → upgrade → data and session intact; new migration applied before new app ships | Pass | manual | P0 | ☐ |
| NFR-06 | Migration safety: apply all new migrations to a copy of production data | Succeeds; defaults preserve behaviour (all six slots, no reminders) | I | P0 | ☐ |
| NFR-07 | Backward compatibility: **old app build** against the new API (no `slot`, no config fields) | Still records glucose; nothing crashes | I | P0 | ☐ |
| NFR-08 | Accessibility: TalkBack reads call buttons, chips and dialogs sensibly; touch targets ≥ 48 dp; contrast | Pass | manual | P2 | ☐ |
| NFR-09 | Battery/notification volume: 4-hour insulin + exercise reminders for 48 h | ≤ expected count; no storms | manual | P2 | ☐ |

---

## 14a. Added after the first draft — home screen, patient diary, export

| ID | Scenario | Expected | Layer | Pri | ☐ |
|---|---|---|---|---|---|
| HOME-01 | Greeting by hour: 03:59 / 04:00 / 11:59 / 12:00 / 16:59 / 17:00 / 19:59 / 20:00 | Night / Morning / Morning / Afternoon / Afternoon / Evening / Evening / Night | U | P1 | ☐ |
| HOME-02 | Day strip shows the last 7 days ending today; no future date is visible or tappable | Yes; weekday letters match each date | W | P0 | ☐ |
| HOME-03 | Tap a day | “Average glucose · <date>” card directly under the strip shows that day’s average, or “no readings” | W | P0 | ☐ |
| HOME-04 | Tap a point on the graph | Detail panel shows date, average, change vs the day before, in/above/below the usual range; the strip moves to that day when it is in view | W, M | P1 | ☐ |
| HOME-05 | Graph is light-themed in the app’s blues; nothing but the graph and its detail panel (no title, no “Lately”, no verdict, no note) | Pass | M | P1 | ☐ |
| HOME-06 | Scroll to the bottom of Home, change language / return from a topic / pull to refresh | Scroll position kept; no full-screen spinner after the first load | M | P0 | ☐ |
| HOME-07 | Switch language while on Help Book, Quizzes or Health | Stays on that tab (does not jump to Home) | M | P0 | ☐ |
| HOME-08 | “More for you” tiles: consistent look; unread answers show a red count on the Help-and-support icon (9+ above nine) | Pass; badge disappears at 0 | W, M | P1 | ☐ |
| HOME-09 | Help Book content corrected on the server | Open list/Home: the new text and pictures appear without leaving and re-entering the screen | M | P0 | ☐ |
| PIN-01 | Wrong PIN | Digits stay in the box; error shown | W | P0 | ☐ |
| PIN-02 | Eye icon | Shows/hides the digits; hidden by default | W | P1 | ☐ |
| DIA-01 | Child 2 days old with details missing | No card, no reminder | U, M | P0 | ☐ |
| DIA-02 | Child 3+ days old with any of sex, DOB, phone, address, height, weight, treating doctor, educator blank | “Complete your child’s details” card on Home with the missing count; tapping opens the details form in edit mode | W, M | P0 | ☐ |
| DIA-03 | Details missing and Reminders on | A notification every day at 6 PM until complete; cancelled as soon as nothing required is blank | M | P0 | ☐ |
| DIA-04 | Hospital numbers left empty | Never counted as missing | U | P1 | ☐ |
| DIA-05 | The tour’s Profile step mentions the details | Yes, in both languages | M | P2 | ☐ |
| EXP-01 | Admin → Participants → **Export patient diary** | Downloads one .xlsx with three sheets: Patient details, Investigations, Daily log | E, I | P0 | ☐ |
| EXP-02 | Patient details sheet | Code, name, sex, DOB, age, hospital no., other hospital no., address, telephone, height, weight, BMI, treating doctor, educator — nothing else | I | P0 | ☐ |
| EXP-03 | Age and BMI | Whole years; weight ÷ height² to one decimal; blank when an input is missing | U | P0 | ☐ |
| EXP-04 | Investigations sheet | Only fasting sugar (pre-breakfast), sugar 2 h after meals (post-meal slots) and HbA1c, per child per day | I | P0 | ☐ |
| EXP-05 | Daily log sheet | Six sugar columns by slot, insulin total, food (carbs g + descriptions), exercise minutes; a reading with no slot is not invented into a column | I | P0 | ☐ |
| EXP-06 | Days bucket in the child’s timezone; mmol/L readings converted to mg/dL | Pass | U | P1 | ☐ |
| EXP-07 | Every export is audited with counts only; unauthorised user gets 403 | Pass | I | P0 | ☐ |
| EXP-08 | File opens in Excel and LibreOffice; Tamil names and addresses intact | Pass | M | P1 | ☐ |

---

## 15. Smoke test (15 minutes, run on every release candidate)

1. Cold start → signed-in user lands on Home (English), switch to Tamil, text size unchanged.
2. Record glucose (pick the slot) → double-check pop-up → saved → shows in Recent.
3. Record insulin and carbs (with “2 dosa”) → saved.
4. Home: SOS opens, call button opens the dialler. Profile: SOS button present.
5. Home: progress graph visible for the seeded multi-day user; hidden for a new user.
6. Health → Share with a guardian → open the link in a browser → code → enter the due reading → confirm → saved; app shows the “entered by” notice; reopening the link says used.
7. Gallery opens; one image and one video play.
8. Admin: change a participant’s health data configuration; refresh the app; chips follow.
9. Admin: add an SOS contact to one child only; only that child sees it.
10. Airplane mode: Home shows the offline banner, SOS still lists contacts.

---

## 16. What is already automated, and the gaps

| Area | Existing tests | Gap to close first |
|---|---|---|
| Validation, permissions, formulas, quiz grading, safety, profile rules | `api/tests/unit/*` (11 files, 186 tests) | Health-config schema, glucose slot rules, SOS phone rule (partly added) |
| Guardian crypto + browser↔server protocol | `guardian-crypto.test.ts`, `guardian-protocol.test.ts` | DB-backed lifecycle (GRD-14…19) needs the integration suite |
| API ↔ DB behaviour | `api/tests/integration/*` (8 files; **off** unless `RUN_INTEGRATION_TESTS=1`) | Needs a throw-away test database; add authorization matrix (SEC-01/02) |
| Admin UI | `tests/e2e/admin.spec.ts` | Bulk selection + review (CFG-04…07), SOS, Gallery |
| Flutter | `app/test/*` (15 files: api client, bilingual auth, signup chat, health record, home cards, language audit, participant features, quizzes, support …) | Progress card (PRG-06…09, pure functions — easy), SOS service, guardian share screen, health-config parsing, double-check dialog |
| Real-device flows | none | Maestro smoke recording of section 15 |

Suggested order of work: (1) a disposable test database + switch integration tests
on in CI, (2) SEC-01/02 table-driven tests, (3) the pure-function Flutter tests
(progress maths, config parsing, phone normalisation), (4) Playwright for bulk
configuration, (5) Maestro smoke.
