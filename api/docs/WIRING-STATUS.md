# Wiring status: admin → backend → database → app

What is connected end to end, and what is still only connected at one end.

The admin dashboard, the API and the database were built first, and the app was
then pointed at them. **Everything below marked "wired" now runs end to end.**
What is left is listed under each heading, and in the last section.

---

## 1. Calculators — wired, and now admin-only

Calculators are **not shown to a parent at all.** The app's Calculators
screen, its `calculator_runner.dart`/`formula.dart`/`unit_conversion.dart`
twins of the server's engine, and the participant-facing
`/api/calculators`/`/api/calculators/values` routes have all been removed.
See `docs/CALCULATORS.md`.

`Calculator` table → create/hide API (unchanged) → **run API**
(`POST /api/admin/calculators/:id/run`) → the admin's own workbench
(`Calculators → Run for a participant`). Staff pick a participant and a
moment in time; a `DATA`-sourced input is filled in from that child's own
records as of that moment and stays overridable, exactly the properties the
old parent-facing screen had — they simply now belong to staff, not the app.

- **Zero, negative and out-of-range numbers are still refused**, by the same
  `runCalculator` the dashboard's "try it" preview already used.
- **What went into a result is shown**, whether it was typed in or came from
  a record, and when that record was made — carried over from the old
  "From your records · 2 h ago" behaviour.
- What the app *does* still collect — glucose, insulin, carbohydrates — feeds
  these runs. Recording them consistently is why they matter; see
  `docs/PARTICIPANT-FEATURES.md` for which of the three a given child is
  enrolled for, and `docs/GLUCOSE-REMINDERS.md` for the reminder that nudges
  a family who has gone quiet.

**Left:** the Rule of 15 is still its own purpose-built screen on the phone.
It is a conditional rule (below 70 → 15 g, retest in 15 min), not a sum, and
the formula grammar has no conditionals on purpose.

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

## 2a. Carbohydrates — wired

`Meal`/`POST /api/meals` already existed, built for a richer nutrition feature
than this app offers; there was no screen. There is now a Carbs screen (Health
tab, and a tile on Home) that records just what this app asks for — grams, a
meal type, when — using that same endpoint. Like glucose and insulin, it
**records; it never calculates.**

## 2b. Participant features and the glucose reminder — wired

- **Which features a child is enrolled for** (glucose, insulin, carbs, Help
  Book, quizzes, help and support) is chosen when the participant is created
  and editable from their record afterwards. Glucose, insulin and carb
  logging are enforced server-side, not just hidden in the app. See
  `docs/PARTICIPANT-FEATURES.md`.
- **A glucose-eligible participant who goes 6 hours without a reading** gets a
  push notification (hourly cron), and staff see the same gap listed on the
  admin's Glucose page. See `docs/GLUCOSE-REMINDERS.md`.

---

## 3. Help Book blocks — wired, one gap

Block editor, drag-to-reorder, EN+TA grouped as one topic, `kind`/`heading`/
`videoUrl` understood by `app/lib/models/topic.dart`, video playback via
`video_player`, and older importer-written blocks still parse unchanged.

**Left:** picture and video **upload is inert until object storage is
configured.** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and
`CLOUDINARY_API_SECRET` are all unset in `api/.env`.

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
