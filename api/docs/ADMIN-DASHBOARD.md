# The admin dashboard: what was built, and how it is tested

A record of the dashboard rebuild — what each part does, why it behaves the
way it does where that is not obvious, and which test proves it works.

For what is still only wired at one end, see [WIRING-STATUS.md](./WIRING-STATUS.md).

**Test totals:** 173 unit tests (`npm test`), plus 96 integration tests against
the development database (`RUN_INTEGRATION_TESTS=1 npm test`) — **269 passing**,
and 139 Dart tests in the app (`flutter test`; the one reported failure is an
empty `language_toggle_test.dart` stub with no tests in it).

---

## 1. Plain language throughout

The people running this dashboard are study coordinators and nurses. Database
vocabulary was removed from every label; it stays in the code.

| Was | Now |
| --- | --- |
| Education | Help Book |
| Content | What families see |
| Participants | Families → Children and parents |
| Profile fields | Families → Questions we ask them |
| Administrators | Who can sign in |
| Audit logs | Activity history |
| Clinical thresholds | Safe glucose ranges |
| Notifications | Announcements |
| DRAFT / PUBLISHED / ARCHIVED | Not finished / Live in the app / Hidden |

**Slugs are gone from the interface.** A slug is a join key — it is what pairs
the English and Tamil versions of a topic — and nothing a coordinator would
recognise. The server generates them now.

## 2. Readable type and a light theme

- The type scale is floored at **16px**; `text-xs` now means 16px and
  everything steps up from there. 40 files using hardcoded `text-[11px]`,
  `[12px]` and `[13px]` were converted, so no sub-16px text remains.
- **Light/dark switch** in the header. Light is the default and it follows the
  computer's setting until someone chooses, then remembers. Applied by an
  inline script before first paint, so there is no flash of the wrong theme.

## 3. Help Book

One row per **topic**, not per stored row — a topic exists in English and
Tamil, and listing those separately made the library look twice as long as it
is and hid which topics had no translation. Each row shows a chip per language,
or an **"Add Tamil"** button where one is missing.

**Drag to reorder**, saving immediately, with up/down buttons beside it (drag
alone is unusable by keyboard). If the save fails the list snaps back, so the
screen never misrepresents what families will see.

**The Markdown editor was replaced with a block editor.** Each section is
*Words only*, *Picture* or *Video*, reorderable, with an optional heading.
Authors are clinical staff; asking them to remember that `##` means a heading
put an obstacle between them and the content.

- Pictures upload at **3:2**, the ratio the phone crops to. A differently
  shaped picture gets a warning, not a rejection — the admin may have the only
  copy, and a slightly-off crop beats no picture.
- Video-only sections are supported, as several source topics are exactly that.
- Topics written by the original importer still open and render unchanged.

| Test | What it proves |
| --- | --- |
| `shows one entry per topic, not one per language` | Grouping is real: fewer entries than stored rows, one per distinct topic |
| `pairs the two languages of a topic into one entry` | Both versions appear under one topic; English names it |
| `reorders both languages of a topic together` | After a drag, **both** stored rows share one position — a half-applied reorder cannot split a topic |

## 4. Quizzes

Same treatment: one row per quiz with a chip per language and an "Add Tamil"
button where a translation is missing. All four question types remain.

Two faults found and fixed while doing it:

- **There was no quiz edit page at all** — quizzes could be created but never
  reopened. Built.
- **The form derived the slug from the title as you typed.** When adding a
  Tamil version this would have overwritten the slug carrying the pairing,
  silently splitting one quiz into two unrelated ones. The title no longer
  touches the slug.

| Test | What it proves |
| --- | --- |
| `shows one entry per quiz, with a slot for each language` | Grouping matches the distinct quizzes actually stored |
| `reports a missing translation rather than hiding it` | An absent language is explicitly null, which is what renders the "Add" button |

## 5. Calculators

Replaces the unused Exercise programmes section (verified empty before its
table was dropped).

**Not shown to a parent.** A calculator is run only by staff, for one named
participant, from **Calculators → Run for a participant** — see
`docs/CALCULATORS.md`. Everything below about how a calculator is defined,
made immutable, and validated is unchanged; only who ever sees a result
changed.

### Created once, never edited

A calculator's formulas are fixed at creation. `active` is the only mutable
field, the API has **no PUT and no DELETE**, and `PATCH` accepts only
`{active}`. Correcting a formula means **"Make a replacement"**: the new one
takes over, the old one is hidden, and both stay on the record with their
original arithmetic.

This is the feature's central safety property. These results are insulin
guidance, so "what did this tell the family in March?" must stay answerable.

### Opening a calculator shows it, and nothing more

Clicking anywhere on a calculator's row opens it, and **nothing on that page can
be changed** — no fields, no switches. It shows what the calculator collects
(where each number comes from, in words rather than codes, and its unit and
allowed range), the formulas behind it as *500 ÷ Total daily insulin dose*, the
safety note, and whether it is currently showing in the app.

Showing or hiding is done from the list, where the switch is. The page a
coordinator reads to check a formula is deliberately not the page where a slip
could change one. A corrected version is made with **"Make a replacement"**.

### The formula engine is a parser, not `eval`

Formulas are written by staff, stored in a database, and executed on a child's
phone — an untrusted input crossing a trust boundary twice. There is an
explicit grammar for arithmetic and nothing else: numbers, variables,
`+ - * / ( )`, and `min/max/round/floor/ceil`. No strings, no property access,
no comparisons, no function definitions.

It runs on the server only now — a calculator is run from the admin
workbench, never on a child's phone — but the grammar itself is unchanged, and
`lib/utils/formula.ts` is still the one place it is implemented.

Three refusals worth naming:

- **Zero and negative numbers are refused** before any arithmetic happens.
  Every quantity these calculators work on — a daily insulin dose, the
  carbohydrates in a meal, a glucose reading — is positive in reality, so a
  zero or a minus sign is a slip of the finger or a field nobody really filled
  in. The parent is told what to do about it: *"Total daily dose" must be more
  than zero. Please check the number and enter it again.* A calculator can
  deliberately accept them by setting that input's minimum to zero or below,
  which is the only way the rule is relaxed.
- **Division by zero is refused**, never allowed to produce Infinity.
- **An unknown name is an error**, not silently zero. A typo like `ttd` for
  `tdd` fails when written, not as a wrong dose months later.

The same `runCalculator` is what the admin's run panel calls, so a number
refused in the "try it" preview at authoring time is refused identically when
staff actually run the calculator for a child later.

### The builder reads the way the sum reads

The answer on the left, an equals sign, the working on the right.

The working is assembled by **choosing values from a list**, not by typing
their short names — an admin picks "Most recent glucose reading" and the name
goes in for them. A dropdown rather than drag-and-drop: it works by keyboard
and on a touchscreen, and nobody has to discover that a thing is draggable.

The list offers what we already hold, values this calculator asks for,
answers worked out further up, and **"Ask the parent for a new number…"**,
which defines one then and there — what the parent sees, its unit, its type,
and the lowest and highest sensible answers. That definition is what the app
receives and renders as a box on the calculator screen.

**Which numbers a calculator collects is derived from its formulas**, never
kept as a second list. Two lists that have to agree are two lists that will
eventually disagree; here, using a value in a sum is what makes the
calculator ask for it. A name typed into a sum that is not a real value is
called out before saving rather than failing obscurely.

Every input and output must declare a **unit** — "enter your glucose" is not a
specification; "enter your glucose (mg/dL)" is.

Formulas are shown in words wherever a person reads them — `500 / tdd`
displays as *500 ÷ Total daily insulin dose* — with the stored text beneath
it. That is cosmetic only; the stored expression is what runs and is never
rewritten from the display.

The builder will not let a calculator be saved until it has been tried once
with real numbers, because it cannot be corrected afterwards.

| Test | What it proves |
| --- | --- |
| `reproduces the curriculum's own formulas from the seeded rows` | The stored calculators give the same answers the app always has (500/20 = 25, 1800/20 = 90) |
| `every seeded input and output declares a unit` | No ambiguous number can reach a parent |
| `refuses a formula naming something that is not an input` | Typos fail at authoring time |
| `refuses a formula that refers to a later result` | A formula cannot read a value that does not exist yet |
| `refuses a 'use data we hold' input naming something we do not hold` | Data sources are checked against the live catalogue |
| `accepts a data-sourced input that names a real catalogue entry` | The valid case genuinely works |
| `can be hidden and shown again, and nothing else about it changes` | Hiding never disturbs the formulas |
| `hides the calculator it replaces, leaving that one's formulas intact` | Superseding preserves the old arithmetic for the record |
| `refuses zero, and says what to do about it` | A parent gets an instruction, not a broken screen |
| `refuses a negative number` | A stray minus sign cannot reach a dose |
| `refuses zero even when the formula would not have divided by it` | The guard is about the number being wrong, not just protecting the arithmetic |
| `allows zero only when the calculator deliberately permits it` | The escape hatch works, so genuinely-zero quantities stay possible |
| `refuses a value outside the range the calculator allows` | Typos like a daily dose of 900 units are caught |
| 24 unit tests in `tests/unit/formula.test.ts` | Grammar, precedence, and **13 injection attempts** that must not evaluate |
| `fills a DATA input from that child's own records`, `lets staff override a value`, `asOf works out what the calculator would have shown at an earlier moment` (`tests/integration/calculator-run-and-participant-features.test.ts`) | The admin workbench, not the phone, is what actually runs a calculator |
| 7 unit tests in `tests/unit/expression-display.test.ts` | Formulas read back in words, and the derived input list matches the sums |

## 6. What a calculator may know about a child

A single closed list. Nothing reaches a formula that is not in it.

| Source | Values |
| --- | --- |
| Glucose | Most recent reading; average today |
| Insulin | Taken today; usual total daily dose (7-day average) |
| Profile | Any question marked **Medical** |

**Engagement data is structurally excluded.** Topics read, quizzes attempted,
badges, streaks — none of it is in the catalogue, so it cannot be wired into a
dose calculation even by accident.

These are two separate features and are kept that way on purpose. Quizzes and
progress exist to *encourage the child*; they are shown back to them as
rewards and say nothing about their body. Calculators work out insulin
guidance from clinical measurements. Nothing from the first may reach the
second.

Two problems found while building this:

- **Glucose is stored with a unit enum** (mg/dL *or* mmol/L) and a formula
  cannot ask which it was handed. An mmol/L reading fed to the 1800 rule would
  be wrong by a factor of **18**. Readings are normalised to mg/dL at the one
  point where stored data becomes a formula variable.
- **A missing reading must never become zero.** With nothing on file the value
  is `null` with a reason ("No glucose reading recorded today"), never 0 — a
  dose computed from a glucose of 0 mg/dL would be dangerous.

Filled-in values always carry **when they were recorded** and stay editable.

| Test | What it proves |
| --- | --- |
| `offers glucose and insulin, and says which have nothing recorded` | The catalogue is complete and every entry has a unit |
| `never offers engagement data to a formula` | Reading progress, quiz scores, streaks and badges are unreachable |
| `reports a missing reading as nothing, never as zero` | The dangerous-default case, asserted explicitly |
| `returns a stored glucose reading in mg/dL with the time it was taken` | The 18× conversion bug cannot recur |

## 7. Profile questions

Questions can be marked **Medical**, which is what makes them available to
calculators. Off by default — a question must be deliberately declared medical
before a dosing formula can read it, so "preferred contact time" cannot be
wired into an insulin calculation by accident.

Medical number questions carry a unit. A medical **choice** question asks for
the number each option counts as, since a formula cannot do arithmetic on the
word "male"; leave them blank and the question simply never appears in the
calculator list rather than contributing a silent zero.

| Test | What it proves |
| --- | --- |
| `appears in the calculator catalogue only once marked medical` | The flag genuinely gates access, in both directions |
| `keeps a medical choice out of the catalogue until every option has a number` | A half-configured choice cannot reach a formula |

---

## Running the tests

```bash
npm test                              # 136 unit tests, no database needed
RUN_INTEGRATION_TESTS=1 npm test      # 186 total, against the dev database
```

Integration tests clean up everything they create. Calculators are removed with
a direct delete because the service deliberately offers no delete — a
calculator families may have used is never destroyed in normal operation.

## 8. Help requests

A parent sends a question about their child from the app; it arrives here; a
coordinator answers; the parent sees the reply and can follow up.

**The status looks after itself.** Answering marks a thread *Answered*; the
family writing again puts it back to *Waiting for an answer*. There is no
dropdown to remember, because the moment somebody forgot, the inbox would
start lying about who is still waiting. *Closed* is the third state and only
stops a thread asking to be dealt with — nothing is ever deleted.

- Threads hang off **the child's own account**, which is who the parent is
  signed in as, so a question cannot be filed against a sibling by mistake.
- **"Read" means the other side opened it.** Opening a thread marks the
  family's messages read, never your own replies.
- `firstRepliedAt` is stamped **once**, so "how long are families waiting"
  stays answerable and a second reply cannot overwrite it.
- **Text only — no links either way.** A coordinator never has to open
  anything a family pastes, so there is nothing to phish. No title field: the
  subject is the first line of the message.
- **3 messages a day per family** (Indian calendar day). Replies do not count.

| Test | What it proves |
| --- | --- |
| `a new question arrives waiting for an answer` | A family's question starts in the queue |
| `counts only the families still waiting` | The inbox badge means what it says |
| `answering marks it answered, without anyone setting a status` | The status cannot drift from the conversation |
| `a family writing again puts it back in the queue` | A follow-up is not lost behind an "answered" label |
| `records when a family was first answered` | "First" means first, not most recent |
| `marks only the other side's messages as read` | "Read" stays meaningful to the family |
| `closing keeps the whole conversation` | Nothing is destroyed |
| `puts the families still waiting at the top of the inbox` | The list is ordered by the job |
| `daily limit` tests in `tests/integration/support.test.ts` | A 4th message in a day is refused, the team's replies are free, and the day rolls over at Indian midnight |

## 9. Removed from the dashboard

- **Announcements** (push campaigns). Nothing in this study sends them.
- **Settings** — general settings and the global feature-flag switches. Both
  are being replaced by per-account permissions, which is where "what can this
  member of staff do" belongs.
- **Exercise programmes**, whose table was empty and is now dropped.

Announcements and Settings were only unlisted, not deleted: their routes and
data are intact and either returns by restoring one navigation entry.
"Questions we ask them" keeps its route and is reached from Families.

## 10. Reports

Medication adherence and exercise minutes were removed from the Reports page,
along with the data they were drawn from: neither is something this study's app
records, so both only ever showed empty charts, which reads as missing data
rather than as "not collected".

What remains is what the app does record: how many children are in the study,
how many entries they have recorded, average glucose over time, and who has
signed up. The wording was changed throughout — "cohort" became *children in the
study*, "records logged" became *entries recorded*, "by account status" became
*by sign-up status* with each status in plain words (*Waiting to be approved*,
*Signed up and using the app*).

Two on-screen mentions of "cohort" and "platform" on the Dashboard and Families
pages were reworded too. The Dashboard itself is still to be rewritten.

## 11. Questions we ask families

Every question a parent is asked about their child is listed in one place, with
its name, the kind of answer it takes, what counts as a good answer, and whether
it is asked at sign-up or on the profile.

**The 13 questions the app has always asked are registered here**, transcribed
from what the app hardcodes (the four sign-up questions and the nine on the
profile screen). Added questions sit alongside them. Each shows in plain words
what it checks — *2 to 80 characters · Letters only*, *Between 50 and 280 cm*,
*Not earlier than the year of "Date of birth"* — generated from the same rules
that enforce it, so what a coordinator reads and what is checked cannot differ.

- **Checks suit the kind of answer.** Words have a length and a letters-only
  option; numbers have a range and whole-numbers-only; dates cannot be in the
  future and can be limited by how long ago. They are a small closed set rather
  than free patterns: "letters only, 2 to 80 characters" is something a
  coordinator can read back and be sure of.
- **The four sign-up questions are locked on** — always asked, always required,
  always asked at sign-up — because a child's account is created from them.
- **A built-in question's checks cannot be loosened.** The server enforces its
  own, so a looser rule here would tell the app to accept what the server then
  rejects. Wording, the medical flag and the sign-up sentence can change.
- **Nothing starts as medical.** Whether height, weight or age may feed a dose
  calculation is the study team's decision, made deliberately.
- **Age is offered to calculators without being stored**, worked out from the
  date of birth once that is marked medical.
- **Built-ins are kept out of the app's own fetch and the save-time "required"
  check.** One function feeds both, so a built-in there would show twice and fail
  every profile save on a "missing" answer that lives in a real column.

**None of this changes what a family sees yet.** The app still asks these from
its own screens; see WIRING-STATUS.md §7 for exactly what has to change.

| Test | What it proves |
| --- | --- |
| `registers every question the app asks` | All 13, none missing |
| `asks exactly the four sign-up questions at sign-up` | Matches the chat |
| `records the type and checks the app enforces today` | The transcription is accurate |
| `keeps the two sex choices the app offers, and no others` | "Prefer not to say" stays withdrawn |
| `starts with nothing marked as medical` | Never a default |
| `never sends a built-in question to the app` | No duplicate on the profile screen |
| `does not let a built-in question block a profile save` | No failed saves on "Child's name is required" |
| `cannot switch off, relax or move a sign-up question` | Sign-up cannot be broken from the dashboard |
| `cannot loosen what the app checks` | Server and app cannot be told different things |
| `cannot add or remove the choices stored in a database column` | A stored value cannot be orphaned |
| `holds a text / number / date answer to its checks` | Added questions are enforced on the server |
| `refuses rules that belong to a different kind of answer` | Nonsense settings fail when written |
| `refuses a range that contradicts itself` | Lowest above highest is caught |
| `cannot take the name of a built-in question` | No collisions |
| `offers height only once it is marked as medical, from its own column` | The medical flag genuinely gates it, and the value comes from the right place |
| `says nothing when height was never entered, rather than zero` | A missing value is never 0 |
| `offers the child's age once the date of birth is marked as medical` | Age is worked out correctly |
| 23 unit tests in `tests/unit/profile-field-rules.test.ts` | Every rule, with the app's own values, including the diagnosed-before-born case |
