# Calculators

The nine calculators in the app, taken from the study documents (Nutrition;
Insulin Types & Storage; Hypoglycaemia; Insulin Pump). They replaced every
earlier calculator. They are view-only: staff can hide one but not edit it.

Parents type the numbers on the phone. Where the phone already holds a value,
it is filled in with the time it was recorded, and the parent can change it.
Zero and negative numbers are refused, except doses in the total-daily-dose
calculator, where 0 is allowed.

| # | Calculator | Inputs | Formula | Worked example from the documents |
|---|---|---|---|---|
| 1 | Total daily dose (TDD) | basal, breakfast, lunch, dinner, other (units) | `basal + breakfast + lunch + dinner + other` | 12 + 3 + 5 + 5 = **25** units |
| 2 | Insulin ratios — rapid-acting | TDD (filled from the last 7 days of logged insulin) | `IC = 500 / TDD`, `ISF = 1800 / TDD` | 500 ÷ 25 = **20** g/unit; 1800 ÷ 25 = **72** mg/dL/unit |
| 3 | Insulin ratios — short-acting (regular) | TDD (filled from logged insulin) | `IC = 500 / TDD`, `ISF = 1500 / TDD` | 500 ÷ 25 = **20**; 1500 ÷ 25 = **60** |
| 4 | Mealtime dose from carbohydrates | carbs (g), IC | `carbs / IC` | 100 ÷ 20 = **5** units |
| 5 | Correction dose | glucose now (filled from the latest reading), target, ISF | `(glucose - target) / ISF` | (330 − 150) ÷ 60 = **+3**; (60 − 150) ÷ 60 = **−1.5** |
| 6 | Total mealtime insulin | carbs, IC, glucose now, target, ISF | `carbs / IC + (glucose - target) / ISF` | 5 + 3 = **8** units |
| 7 | Sugar needed to treat a low | glucose now, target | `max((target - glucose) / 5, 0)` | (100 − 40) ÷ 5 = **12** g |
| 8 | 40-unit syringe with 100-unit insulin | dose | `dose / 2.5` | 20 ÷ 2.5 = **8** units |
| 9 | Insulin pump basal rates | TDD (filled from logged insulin) | daily `= TDD × 0.8`; hourly `= daily / 24`; 12–4 am `= hourly × 0.5`; 4–10 am `= hourly × 1.5`; 10 am–midnight `= hourly` | 25 × 0.8 = **20**/day |

Every result carries a note: these are starting points, and the diabetes team
should confirm them before a dose is changed.

## Not included

The Rule of 15 (eat 15 g, recheck in 15 minutes) is a rule with conditions,
not a sum, so it is not a calculator. The questionnaire score bands in the
research proposal (quality of life, caregiver satisfaction) are scored by the
research team, not by parents.

## Where things are

- Definitions: `scripts/seed-standard-calculators.ts`
  (`npx tsx scripts/seed-standard-calculators.ts --replace` deletes every
  existing calculator and adds these nine).
- Tests with each worked example: `tests/integration/admin-dashboard.test.ts`.
- Health screens and calculators sit behind the parent's PIN on the phone.
- Researcher figures (average glucose, time in range, estimated HbA1c,
  average daily insulin) are on the admin Reports page.
