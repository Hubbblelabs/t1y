"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Calculator, Loader2, Plus, Save, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { humaniseExpression, namesUsedIn } from "@/lib/utils/expression-display";

/** One entry from /api/admin/calculator-data — something we already hold. */
interface CatalogueVariable {
  key: string;
  labelEn: string;
  unit: string | null;
  source: "GLUCOSE" | "INSULIN" | "PROFILE";
  descriptionEn: string;
  hasData: boolean;
}

const SOURCE_GROUP_LABEL: Record<CatalogueVariable["source"], string> = {
  GLUCOSE: "Glucose readings",
  INSULIN: "Insulin records",
  PROFILE: "Medical details on the profile",
};

/** A number this calculator asks the parent for, defined here and now. */
interface CustomInput {
  key: string;
  labelEn: string;
  unit: string;
  min: string;
  max: string;
  helpEn: string;
}

/** One answer the calculator works out. */
interface Outcome {
  key: string;
  labelEn: string;
  unit: string;
  decimals: string;
  expression: string;
}

const OPERATORS = ["+", "−", "×", "÷", "(", ")"] as const;

/** What the admin clicks, and what actually goes into the formula. */
const OPERATOR_TEXT: Record<(typeof OPERATORS)[number], string> = {
  "+": "+",
  "−": "-",
  "×": "*",
  "÷": "/",
  "(": "(",
  ")": ")",
};

function blankOutcome(index: number): Outcome {
  return { key: index === 0 ? "answer" : `answer${index + 1}`, labelEn: "", unit: "", decimals: "1", expression: "" };
}

function numberOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Builds a calculator.
 *
 * Reads the way the sum reads: the answer on the left, an equals sign, and
 * the working on the right. The working is assembled by choosing values
 * rather than typing their short names, so an admin never has to remember
 * that the glucose reading is called `glucose_latest` — they pick "Most
 * recent glucose reading" from a list and the name goes in for them.
 *
 * Which numbers the calculator collects is *derived from the formulas*, not
 * kept as a second list. Two lists that have to agree are two lists that will
 * eventually disagree; here, using a value in a sum is what makes the
 * calculator ask for it.
 *
 * The "Try it" panel is not a nicety. A calculator cannot be changed once
 * saved — that is the deliberate safety rule, because these results are
 * insulin guidance — so trying it with real numbers is the only chance to
 * catch a formula that is valid arithmetic but the wrong arithmetic.
 */
export function CalculatorBuilder({
  supersedes,
}: {
  supersedes?: { id: string; name: string };
}) {
  const router = useRouter();

  const [nameEn, setNameEn] = React.useState(supersedes ? `${supersedes.name} (new version)` : "");
  const [nameTa, setNameTa] = React.useState("");
  const [descriptionEn, setDescriptionEn] = React.useState("");
  const [noteEn, setNoteEn] = React.useState(
    "Always check with your doctor or nurse before changing a dose.",
  );

  const [outcomes, setOutcomes] = React.useState<Outcome[]>([blankOutcome(0)]);
  const [customInputs, setCustomInputs] = React.useState<CustomInput[]>([]);
  const [catalogue, setCatalogue] = React.useState<CatalogueVariable[]>([]);
  const [catalogueError, setCatalogueError] = React.useState<string | null>(null);

  const [creatingCustomFor, setCreatingCustomFor] = React.useState<number | null>(null);

  const [sampleValues, setSampleValues] = React.useState<Record<string, string>>({});
  const [preview, setPreview] = React.useState<Array<{ key: string; value: number }> | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewPending, setPreviewPending] = React.useState(false);
  const [triedIt, setTriedIt] = React.useState(false);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/calculator-data");
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setCatalogueError("Could not load the list of data we already hold.");
          return;
        }
        setCatalogue(json.data);
      } catch {
        if (!cancelled) setCatalogueError("Could not load the list of data we already hold.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Every name that could legitimately appear in a formula, with its label. */
  const labels = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const variable of catalogue) map[variable.key] = variable.labelEn;
    for (const custom of customInputs) map[custom.key] = custom.labelEn || custom.key;
    for (const outcome of outcomes) map[outcome.key] = outcome.labelEn || outcome.key;
    return map;
  }, [catalogue, customInputs, outcomes]);

  /**
   * The numbers this calculator collects, worked out from the formulas.
   *
   * An earlier answer used in a later formula is not something to collect —
   * it is already being worked out — so outcome names are filtered out.
   */
  const derivedInputs = React.useMemo(() => {
    const outcomeKeys = new Set(outcomes.map((outcome) => outcome.key));
    const used = namesUsedIn(outcomes.map((outcome) => outcome.expression));

    return used
      .filter((name) => !outcomeKeys.has(name))
      .map((name) => {
        const fromCatalogue = catalogue.find((variable) => variable.key === name);
        if (fromCatalogue) {
          return {
            key: name,
            labelEn: fromCatalogue.labelEn,
            unit: fromCatalogue.unit ?? "",
            min: null as number | null,
            max: null as number | null,
            helpEn: null as string | null,
            source: "DATA" as const,
            sourceKey: name,
            known: true,
          };
        }

        const custom = customInputs.find((input) => input.key === name);
        if (custom) {
          return {
            key: name,
            labelEn: custom.labelEn,
            unit: custom.unit,
            min: numberOrNull(custom.min),
            max: numberOrNull(custom.max),
            helpEn: custom.helpEn || null,
            source: "ASK" as const,
            sourceKey: null,
            known: true,
          };
        }

        // Typed by hand into a formula and never defined. Surfaced rather
        // than silently dropped, because the save would fail on it anyway.
        return {
          key: name,
          labelEn: name,
          unit: "",
          min: null as number | null,
          max: null as number | null,
          helpEn: null as string | null,
          source: "ASK" as const,
          sourceKey: null,
          known: false,
        };
      });
  }, [outcomes, catalogue, customInputs]);

  const unknownNames = derivedInputs.filter((input) => !input.known);

  function updateOutcome(index: number, patch: Partial<Outcome>) {
    setOutcomes((prev) => prev.map((outcome, i) => (i === index ? { ...outcome, ...patch } : outcome)));
  }

  /** Appends a token to an outcome's formula, spaced so it stays readable. */
  function insert(index: number, text: string) {
    setOutcomes((prev) =>
      prev.map((outcome, i) =>
        i === index
          ? { ...outcome, expression: `${outcome.expression} ${text}`.replace(/\s+/g, " ").trim() }
          : outcome,
      ),
    );
  }

  function buildPayload() {
    return {
      nameEn,
      nameTa: nameTa || null,
      descriptionEn: descriptionEn || null,
      noteEn: noteEn || null,
      inputs: derivedInputs.map((input) => ({
        key: input.key,
        labelEn: input.labelEn,
        unit: input.unit,
        min: input.min,
        max: input.max,
        helpEn: input.helpEn,
        source: input.source,
        sourceKey: input.sourceKey,
        valueType: "NUMBER" as const,
      })),
      outputs: outcomes.map((outcome) => ({
        key: outcome.key,
        labelEn: outcome.labelEn,
        unit: outcome.unit,
        decimals: numberOrNull(outcome.decimals) ?? 1,
        expression: outcome.expression,
      })),
      ...(supersedes ? { supersedesId: supersedes.id } : {}),
    };
  }

  async function handlePreview() {
    setPreviewPending(true);
    setPreviewError(null);
    setPreview(null);
    try {
      const payload = buildPayload();
      const values: Record<string, number> = {};
      for (const input of derivedInputs) {
        const parsed = numberOrNull(sampleValues[input.key] ?? "");
        if (parsed !== null) values[input.key] = parsed;
      }

      const response = await fetch("/api/admin/calculators/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: payload.inputs, outputs: payload.outputs, values }),
      });
      const json = await response.json();

      if (!response.ok) {
        setPreviewError(json?.error?.message ?? "This calculator could not be tried.");
        return;
      }
      if (json.data.error) {
        setPreviewError(json.data.error);
        return;
      }
      setPreview(json.data.results);
      setTriedIt(true);
    } catch {
      setPreviewError("Could not try this calculator. Check your connection.");
    } finally {
      setPreviewPending(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/admin/calculators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json?.error?.message ?? "This calculator could not be saved.");
        const issues: Record<string, string> = {};
        for (const issue of json?.error?.issues ?? []) issues[issue.field] = issue.message;
        setFieldErrors(issues);
        return;
      }

      router.push("/admin/content/calculators");
      router.refresh();
    } catch {
      setError("This calculator could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div
          role="alert"
          className="bg-danger-soft text-danger flex items-start gap-2 rounded-md p-3 text-sm font-semibold"
        >
          <AlertCircle className="mt-px size-5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="bg-info-soft text-ink rounded-md p-3 text-sm">
        <strong>You are writing a formula, not working anything out here.</strong> What you save is
        sent to the app, and the app does the sums on the family&apos;s own phone — with whichever
        reading they pick. Anything you use below that we do not already hold is asked for on the
        screen.
      </div>

      <div className="bg-warning-soft text-ink rounded-md p-3 text-sm">
        <strong>A calculator cannot be changed after you save it.</strong> You can hide it, and you
        can make a replacement, but the sums stay exactly as you write them here — so a family who
        used it last week still gets the same answer today. Please try it before saving.
      </div>

      {supersedes ? (
        <p className="bg-info-soft text-info rounded-md px-3 py-2 text-sm">
          Saving this will hide <strong>{supersedes.name}</strong> and put this one in its place.
        </p>
      ) : null}

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Calculator name" htmlFor="nameEn" error={fieldErrors.nameEn} required>
            <Input id="nameEn" value={nameEn} onChange={(event) => setNameEn(event.target.value)} />
          </Field>
          <Field label="Name in Tamil (optional)" htmlFor="nameTa">
            <Input id="nameTa" value={nameTa} onChange={(event) => setNameTa(event.target.value)} />
          </Field>
          <Field label="What it is for" htmlFor="descriptionEn" className="sm:col-span-2">
            <Textarea
              id="descriptionEn"
              rows={2}
              value={descriptionEn}
              onChange={(event) => setDescriptionEn(event.target.value)}
            />
          </Field>
          <Field label="Safety note shown with the answer" htmlFor="noteEn" className="sm:col-span-2">
            <Textarea
              id="noteEn"
              rows={2}
              value={noteEn}
              onChange={(event) => setNoteEn(event.target.value)}
            />
          </Field>
        </div>
      </Card>

      {catalogueError ? (
        <p role="alert" className="text-danger text-sm font-semibold">
          {catalogueError}
        </p>
      ) : null}

      {outcomes.map((outcome, index) => (
        <Card key={index} className="p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_auto_minmax(0,1fr)] lg:items-start">
            {/* Left: what is being worked out. */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-ink font-semibold">The answer</h2>
                {outcomes.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOutcomes((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`Remove answer ${index + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>

              <Field
                label="What the parent sees"
                htmlFor={`out-label-${index}`}
                error={fieldErrors[`outputs.${index}.labelEn`]}
                required
              >
                <Input
                  id={`out-label-${index}`}
                  value={outcome.labelEn}
                  placeholder="Insulin-to-carb ratio"
                  onChange={(event) => updateOutcome(index, { labelEn: event.target.value })}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Unit"
                  htmlFor={`out-unit-${index}`}
                  error={fieldErrors[`outputs.${index}.unit`]}
                  required
                >
                  <Input
                    id={`out-unit-${index}`}
                    value={outcome.unit}
                    placeholder="g per unit"
                    onChange={(event) => updateOutcome(index, { unit: event.target.value })}
                  />
                </Field>
                <Field label="Decimal places" htmlFor={`out-dec-${index}`}>
                  <Input
                    id={`out-dec-${index}`}
                    value={outcome.decimals}
                    inputMode="numeric"
                    onChange={(event) => updateOutcome(index, { decimals: event.target.value })}
                  />
                </Field>
              </div>
            </div>

            <div className="text-ink-subtle hidden pt-9 text-3xl lg:block" aria-hidden="true">
              =
            </div>

            {/* Right: how it is worked out. */}
            <div className="space-y-3">
              <h2 className="text-ink font-semibold">How it is worked out</h2>

              <div
                className="border-line bg-surface-sunken min-h-16 rounded-md border p-3"
                aria-live="polite"
              >
                {outcome.expression ? (
                  <>
                    <p className="text-ink text-sm">
                      {humaniseExpression(outcome.expression, labels)}
                    </p>
                    <p className="text-ink-subtle mt-1 font-mono text-xs">{outcome.expression}</p>
                  </>
                ) : (
                  <p className="text-ink-subtle text-sm">
                    Nothing yet. Choose a value below, then an operator, and keep going.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ValuePicker
                  catalogue={catalogue}
                  customInputs={customInputs}
                  earlierAnswers={outcomes.slice(0, index)}
                  onPick={(name) => insert(index, name)}
                  onCreateCustom={() => setCreatingCustomFor(index)}
                />

                {OPERATORS.map((symbol) => (
                  <Button
                    key={symbol}
                    variant="secondary"
                    size="sm"
                    onClick={() => insert(index, OPERATOR_TEXT[symbol])}
                    aria-label={`Insert ${symbol}`}
                  >
                    {symbol}
                  </Button>
                ))}

                <NumberInserter onInsert={(value) => insert(index, value)} />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateOutcome(index, { expression: "" })}
                  disabled={!outcome.expression}
                >
                  <X className="size-4" aria-hidden="true" />
                  Clear
                </Button>
              </div>

              <Field
                label="Or write it yourself"
                htmlFor={`out-expr-${index}`}
                error={fieldErrors[`outputs.${index}.expression`]}
                hint="Only + − × ÷ brackets and the values above."
              >
                <Input
                  id={`out-expr-${index}`}
                  value={outcome.expression}
                  className="font-mono"
                  onChange={(event) => updateOutcome(index, { expression: event.target.value })}
                />
              </Field>
            </div>
          </div>

          {creatingCustomFor === index ? (
            <CustomInputForm
              existingKeys={[
                ...catalogue.map((variable) => variable.key),
                ...customInputs.map((input) => input.key),
              ]}
              onCancel={() => setCreatingCustomFor(null)}
              onCreate={(created) => {
                setCustomInputs((prev) => [...prev, created]);
                insert(index, created.key);
                setCreatingCustomFor(null);
              }}
            />
          ) : null}
        </Card>
      ))}

      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOutcomes((prev) => [...prev, blankOutcome(prev.length)])}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add another answer
        </Button>
      </div>

      <Card className="p-4">
        <h2 className="text-ink mb-1 font-semibold">What this calculator will collect</h2>
        <p className="text-ink-muted mb-3 text-sm">
          Worked out from the sums above — using a value is what makes the calculator ask for it.
        </p>

        {derivedInputs.length === 0 ? (
          <p className="text-ink-subtle text-sm">Nothing yet.</p>
        ) : (
          <ul className="divide-line divide-y">
            {derivedInputs.map((input) => (
              <li key={input.key} className="flex flex-wrap items-center gap-2 py-2">
                <span className="text-ink flex-1 text-sm">
                  {input.labelEn}
                  {input.unit ? <span className="text-ink-subtle"> ({input.unit})</span> : null}
                </span>
                {input.known ? (
                  <Badge tone={input.source === "DATA" ? "info" : "neutral"}>
                    {input.source === "DATA" ? "We already hold this" : "Asked on the screen"}
                  </Badge>
                ) : (
                  <Badge tone="danger">Not defined — add it as a custom value</Badge>
                )}
              </li>
            ))}
          </ul>
        )}

        {unknownNames.length > 0 ? (
          <p role="alert" className="text-danger mt-3 text-sm font-semibold">
            {unknownNames.map((input) => `"${input.key}"`).join(", ")} appears in a sum but is not a
            value we hold or one you have created. Saving will fail until that is fixed.
          </p>
        ) : null}
      </Card>

      <Card className="p-4">
        <h2 className="text-ink mb-1 font-semibold">Try it</h2>
        <p className="text-ink-muted mb-4 text-sm">
          Put in some numbers a parent might really type, and check the answers are what you expect.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {derivedInputs.map((input) => (
            <Field key={input.key} label={input.labelEn || input.key} htmlFor={`try-${input.key}`}>
              <Input
                id={`try-${input.key}`}
                inputMode="decimal"
                value={sampleValues[input.key] ?? ""}
                onChange={(event) =>
                  setSampleValues((prev) => ({ ...prev, [input.key]: event.target.value }))
                }
              />
            </Field>
          ))}
        </div>

        <Button
          variant="secondary"
          className="mt-3"
          onClick={handlePreview}
          disabled={previewPending || derivedInputs.length === 0}
        >
          {previewPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Calculator className="size-4" aria-hidden="true" />
          )}
          Work it out
        </Button>

        {previewError ? (
          <p role="alert" className="text-danger mt-3 text-sm font-semibold">
            {previewError}
          </p>
        ) : null}

        {preview ? (
          <dl className="border-line mt-3 divide-y rounded-md border">
            {preview.map((result) => {
              const outcome = outcomes.find((row) => row.key === result.key);
              const decimals = numberOrNull(outcome?.decimals ?? "1") ?? 1;
              return (
                <div key={result.key} className="flex items-baseline justify-between px-3 py-2">
                  <dt className="text-ink-muted text-sm">{outcome?.labelEn || result.key}</dt>
                  <dd className="text-ink tabular font-semibold">
                    {result.value.toFixed(decimals)} {outcome?.unit}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}
      </Card>

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={handleSave} disabled={saving || !triedIt}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Save calculator
        </Button>
        {!triedIt ? (
          <span className="text-ink-muted text-sm">Try it once above before you can save.</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Choosing a value to drop into a formula.
 *
 * A plain select rather than drag-and-drop: it works by keyboard and on a
 * touchscreen, it groups naturally, and nobody has to discover that a thing
 * is draggable.
 */
function ValuePicker({
  catalogue,
  customInputs,
  earlierAnswers,
  onPick,
  onCreateCustom,
}: {
  catalogue: CatalogueVariable[];
  customInputs: CustomInput[];
  earlierAnswers: Outcome[];
  onPick: (name: string) => void;
  onCreateCustom: () => void;
}) {
  return (
    <select
      className="border-line bg-surface text-ink h-9 rounded-md border px-2 text-sm"
      value=""
      onChange={(event) => {
        const chosen = event.target.value;
        if (!chosen) return;
        if (chosen === "__custom__") onCreateCustom();
        else onPick(chosen);
        event.target.value = "";
      }}
    >
      <option value="">Insert a value…</option>

      {(["GLUCOSE", "INSULIN", "PROFILE"] as const).map((group) => {
        const entries = catalogue.filter((entry) => entry.source === group);
        if (entries.length === 0) return null;
        return (
          <optgroup key={group} label={SOURCE_GROUP_LABEL[group]}>
            {entries.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.labelEn}
                {entry.hasData ? "" : " — nothing recorded yet"}
              </option>
            ))}
          </optgroup>
        );
      })}

      {customInputs.length > 0 ? (
        <optgroup label="Asked for on the screen">
          {customInputs.map((input) => (
            <option key={input.key} value={input.key}>
              {input.labelEn || input.key}
            </option>
          ))}
        </optgroup>
      ) : null}

      {earlierAnswers.length > 0 ? (
        <optgroup label="Answers worked out above">
          {earlierAnswers.map((answer) => (
            <option key={answer.key} value={answer.key}>
              {answer.labelEn || answer.key}
            </option>
          ))}
        </optgroup>
      ) : null}

      <optgroup label="Something else">
        <option value="__custom__">+ Ask the parent for a new number…</option>
      </optgroup>
    </select>
  );
}

/** A plain number, typed and inserted. */
function NumberInserter({ onInsert }: { onInsert: (value: string) => void }) {
  const [value, setValue] = React.useState("");

  function commit() {
    const trimmed = value.trim();
    if (!trimmed || !Number.isFinite(Number(trimmed))) return;
    onInsert(trimmed);
    setValue("");
  }

  return (
    <span className="flex items-center gap-1">
      <Input
        value={value}
        inputMode="decimal"
        placeholder="number"
        className="h-9 w-24"
        aria-label="A number to insert"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
      <Button variant="secondary" size="sm" onClick={commit} disabled={!value.trim()}>
        Insert
      </Button>
    </span>
  );
}

/**
 * Defining a number to ask the parent for.
 *
 * The short name is generated from the label rather than typed: it is a
 * formula identifier, not something a coordinator should have to invent or
 * keep unique.
 */
function CustomInputForm({
  existingKeys,
  onCancel,
  onCreate,
}: {
  existingKeys: string[];
  onCancel: () => void;
  onCreate: (input: CustomInput) => void;
}) {
  const [labelEn, setLabelEn] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [min, setMin] = React.useState("");
  const [max, setMax] = React.useState("");
  const [helpEn, setHelpEn] = React.useState("");
  const [problem, setProblem] = React.useState<string | null>(null);

  function keyFor(label: string): string {
    const camel = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1)))
      .join("");
    const stem = /^[a-z]/.test(camel) ? camel.slice(0, 40) : `value${camel}`.slice(0, 40);

    if (!existingKeys.includes(stem)) return stem;
    let suffix = 2;
    while (existingKeys.includes(`${stem}${suffix}`)) suffix += 1;
    return `${stem}${suffix}`;
  }

  function submit() {
    if (!labelEn.trim()) {
      setProblem("Give it a name the parent will understand.");
      return;
    }
    if (!unit.trim()) {
      setProblem("Give it a unit, so the parent knows what to type.");
      return;
    }
    const lowest = numberOrNull(min);
    const highest = numberOrNull(max);
    if (lowest != null && highest != null && lowest > highest) {
      setProblem("The lowest allowed cannot be more than the highest.");
      return;
    }

    onCreate({ key: keyFor(labelEn), labelEn: labelEn.trim(), unit: unit.trim(), min, max, helpEn: helpEn.trim() });
  }

  return (
    <div className="border-line bg-surface-sunken mt-4 rounded-md border p-3">
      <h3 className="text-ink mb-1 font-semibold">Ask the parent for a new number</h3>
      <p className="text-ink-muted mb-3 text-sm">
        This becomes a box on the calculator screen in the app. Say what it is, what unit it is in,
        and what counts as a sensible answer.
      </p>

      {problem ? (
        <p role="alert" className="text-danger mb-3 text-sm font-semibold">
          {problem}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="What the parent sees" htmlFor="custom-label" className="sm:col-span-2" required>
          <Input
            id="custom-label"
            value={labelEn}
            placeholder="Carbohydrates in this meal"
            onChange={(event) => setLabelEn(event.target.value)}
          />
        </Field>
        <Field label="Unit" htmlFor="custom-unit" required>
          <Input
            id="custom-unit"
            value={unit}
            placeholder="g"
            onChange={(event) => setUnit(event.target.value)}
          />
        </Field>
        <Field label="Type" htmlFor="custom-type">
          <Input id="custom-type" value="Number" readOnly className="bg-surface-sunken" />
        </Field>
        <Field label="Lowest sensible answer" htmlFor="custom-min">
          <Input
            id="custom-min"
            value={min}
            inputMode="decimal"
            placeholder="1"
            onChange={(event) => setMin(event.target.value)}
          />
        </Field>
        <Field label="Highest sensible answer" htmlFor="custom-max">
          <Input
            id="custom-max"
            value={max}
            inputMode="decimal"
            placeholder="500"
            onChange={(event) => setMax(event.target.value)}
          />
        </Field>
        <Field label="Note under the box (optional)" htmlFor="custom-help" className="sm:col-span-2">
          <Input
            id="custom-help"
            value={helpEn}
            placeholder="Count the whole meal"
            onChange={(event) => setHelpEn(event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="primary" size="sm" onClick={submit}>
          Add it to the sum
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
