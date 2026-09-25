# Wiring status: admin → backend → database → app

What is connected end to end, and what is still only connected at one end.

The admin dashboard, the API and the database were built first, and the app was
then pointed at them. **Everything below marked "wired" now runs end to end.**
What is left is listed under each heading, and in the last section.

---

## 1. Calculators — wired

`Calculator` table → create/hide API → `GET /api/calculators` (definitions) and
`GET /api/calculators/values` (a child's own stored numbers) → the app.

- The app fetches the definitions and caches them, so a calculator works with no
  connection. Only *pre-filling from records* needs the network, and when that
  fails the parent simply types the number.
- The hardcoded `_InsulinCalculatorCard` (formulas written in Dart) is **gone**.
  The glucose screen now has a doorway to `screens/calculators/`, and Home has a
  tile. The three seeded calculators reproduce its arithmetic exactly (500 ÷ dose,
  1800 ÷ dose, 1500 ÷ dose, carbs ÷ ratio) — checked in both suites.
- The phone evaluates formulas itself with `services/formula.dart`, the twin of
  the server's parser; `services/calculator_runner.dart` twins `runCalculator`
  and asserts the *same error wording* as the dashboard.
- **Zero, negative and out-of-range numbers are refused** with an instruction
  ("…must be more than zero. Please check the number and enter it again.").
- **Filled-in values show when they were recorded** ("From your records · 2 h
  ago"), stay editable, and become "Entered by you" the moment they are typed
  over. A missing reading is an empty box and a message, never a zero.
- **Units are converted on the phone.** A glucose box offers mmol/L; 5.5 mmol/L
  is converted to 99 mg/dL *before* the formula sees it, and switching units
  converts what is already in the box. Pounds/kg and inches/cm are covered too.
  The stored calculator names one unit and never changes.
- Every calculator opens with the "educational aid" disclaimer first.
- Sign-out clears the cached list, so a shared phone does not show the previous
  family's.

**Left:** the Rule of 15 is still its own purpose-built screen. It is a
conditional rule (below 70 → 15 g, retest in 15 min), not a sum, and the formula
grammar has no conditionals on purpose.

---

## 2. Insulin — wired

`InsulinLog` table and `POST/GET /api/insulin` already existed; nothing in the app
wrote to them. There is now an Insulin screen (Health tab, and a tile on Home)
to record a dose — kind, name, units, when — with today's total and a recent
list. It validates the server's own limits (more than 0, no more than 300 units).

It **records; it never advises**, and says so on screen. Gated on the server by
`health_logging_enabled`, like glucose, so it is only offered where glucose is.

This is what makes the two insulin entries in the calculator data catalogue
("Insulin taken today", "Usual total daily insulin dose") real: they were reading
an empty table.

---

## 3. Help Book blocks — wired, one gap

Block editor, drag-to-reorder, EN+TA grouped as one topic, `kind`/`heading`/
`videoUrl` understood by `app/lib/models/topic.dart`, video playback via
`video_player`, and older importer-written blocks still parse unchanged.

**Left:** picture and video **upload is inert until object storage is
configured.** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_NAME` and `R2_PUBLIC_BASE_URL` are all unset in `api/.env`.

---

## 4. Medical profile questions — wired

`isMedical`, `unit` and per-choice numbers on a question feed the calculator data
catalogue: height and weight (read from their real profile columns), and age,
which is worked out from the date of birth rather than stored. Nothing starts as
medical — the study team decides.

---

## 5. Quizzes — wired

Admin lists one row per quiz with EN/TA chips; the app already read quizzes by
topic with English fallback. All 3 quizzes are English-only today, so a family
reading in Tamil gets the English quiz.

---

## 6. Help requests — wired

`SupportThread`/`SupportMessage` → admin inbox → parent routes
(`GET/POST /api/support`, `GET/POST /api/support/[id]`) → app.

- Profile → **Help and support** (and the previously dead-end "Correct or delete
  your data" tile) opens the parent's questions: ask a new one, follow a
  conversation, reply.
- A question shows **Sent** → **Seen by the team** → **Replied** → **Closed**,
  worked out from the conversation. A follow-up puts it back to Sent.
- Home shows a **New answer** highlight on the Help tile when the team has
  replied and it has not been opened.
- **Text only, no links and no title** — a parent writes just a message; the
  inbox title is its first line. A parent may send **3 messages a day** (Indian
  calendar day); the team's replies are not counted. The phone shows how many
  are left and the server enforces it.
- **No attempt counts or lock-outs** on M-PIN or sign-in, by decision of the
  study team: a wrong PIN says "try again" and nothing more.
- A parent can only ever reach their own conversations; another family's id is
  reported as not found, never as forbidden.

---

## 7. Questions we ask families — wired

The dashboard's list of questions now drives the app.

- **Sign-up chat** asks whatever the dashboard marks "ask at sign-up", from
  `GET /api/signup-questions` — a **public** endpoint, since sign-up happens
  before anyone is signed in. It carries nothing admin-only.
- **Profile edit screen** and **View all details** are drawn from
  `GET /api/profile-questions` — built-in and added questions together, grouped
  by section. (This screen used to list a fixed set and never showed answers to
  added questions at all.)
- Each answer goes to the right place: built-in → a real profile column, added →
  the free-form bucket. Editing can *clear* an answer; signing up leaves it out.
- **The phone applies the same checks as the server** (`profile_field_rules.dart`
  twins `profile-field-rules.ts`, same wording, same tests), so a slip is caught
  as it is typed.
- **It works with no connection.** The list is cached on the phone, and a copy of
  the original 13 questions is bundled with the app as a last resort, so sign-up
  can never be stopped by a request that did not come back. A list missing any of
  the four sign-up questions is treated as a server fault and ignored.
- A question added without a sign-up sentence falls back to its label. An
  optional question shows a **Skip**.
- `GET /api/profile-fields` is unchanged, so older installs of the app keep
  working.

**Left:**

- **Tamil sign-up wording** now exists for the four sign-up sentences. A question
  an admin adds shows English only until they give it a Tamil sentence.
- **Section headings are English** in the dashboard. The five the app has always
  had are mapped back to their existing Tamil; a section an admin invents shows
  as written.
- **The server enforces its own hardcoded checks for built-in questions**, not
  the dashboard's. Where they differ, the phone is stricter (name: 80 letters vs
  120 anything; date of birth: 25 years vs any date). The dashboard cannot loosen
  a built-in check, so the two cannot disagree in the dangerous direction.
- "Must be answered" for the nine non-sign-up built-ins is enforced by the phone
  only.

---

## 7a. Sign-in and sign-up show both languages

The sign-in and sign-up screens no longer follow the language switch, and the
switch is gone from them. Every heading, label and button shows **English, with
the Tamil translation beneath it in a smaller size**; the sign-up chat does the
same in its bubbles and choice chips. The Terms screen shows the full English
terms with the full Tamil text below, so the Tamil is on the page at the moment
of consent. The Tamil comes from the existing strings — `S.both(() => …)` reads
one in each language — so it is not written out twice.

The rest of the app (Home, Help Book, Profile…) still follows the language
switch.

---

## 8. Why the app could sit on a white screen

Found while wiring this. Two real causes, both fixed:

1. **No request had a timeout.** `package:http` has none of its own, so a request
   to an address that did not answer waited for the operating system to give up —
   over a minute on iOS — and every screen that awaited one sat on a spinner. From
   the outside that is indistinguishable from a crash. Every request now gives up
   after 15 seconds with a readable message.
2. **The Home screen loaded six things inside one `Future.wait`,** which throws as
   soon as *any* of them does. Its loading flag was only cleared afterwards, so
   one failure left the whole screen on a spinner for good. Each call is now
   guarded on its own and contributes an empty value if it fails.

Also: a widget that throws while drawing now shows a plain message instead of a
blank box, and the phone must be **rebuilt, not hot-reloaded**, whenever a
native plugin is added (`video_player` and `url_launcher` both were).

---

## Remaining work

- **Per-user permissions** — replace the global feature-flags page with
  per-account capabilities chosen when a staff account is created.
- **Dashboard rewrite** — sign-in counts and activity in plain language, and
  topic names instead of internal ids on its chart.
- **New-admin guided tour.**
- **Object storage** for picture and video upload (see §3).
