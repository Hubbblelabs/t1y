"use client";

import * as React from "react";
import { Loader2, Lock, Pencil, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  describeRules,
  type ProfileFieldRules,
  type ProfileFieldType,
} from "@/lib/services/profile-field-rules";

interface ChoiceOption {
  value: string;
  labelEn: string;
  labelTa?: string;
  /** What this choice counts as in a calculator, on a medical question. */
  numericValue?: number | null;
}

export interface ProfileFieldRow {
  id: string;
  key: string;
  fieldType: ProfileFieldType;
  section: string;
  required: boolean;
  active: boolean;
  sortOrder: number;
  labelEn: string;
  labelTa: string | null;
  hintEn: string | null;
  hintTa: string | null;
  options: ChoiceOption[] | null;
  isMedical: boolean;
  unit: string | null;
  builtIn: boolean;
  showOnSignup: boolean;
  promptEn: string | null;
  promptTa: string | null;
  rules: ProfileFieldRules | null;
  createdAt: string;
  updatedAt: string;
}

/** What each kind of answer is called to someone who has never seen a database. */
const TYPE_LABEL: Record<ProfileFieldType, string> = {
  TEXT: "Words",
  NUMBER: "A number",
  DATE: "A date",
  CHOICE: "Pick one",
};

/** The four questions sign-up cannot work without; mirrors CORE_BUILT_IN_KEYS. */
const CORE_KEYS = ["name", "dateOfBirth", "sex", "diagnosisYear"];

/**
 * Every question a parent is asked about their child — the ones built into
 * the app and the ones added here — with its type, its checks, and whether it
 * is asked at sign-up or left to the profile screen.
 *
 * There is no delete. Turning a question off is how it is retired, and the
 * server forces "Required" off in that same write, so a retired question can
 * never leave an existing profile looking incomplete for something it will
 * no longer be asked.
 */
export function ProfileFieldsPanel({ initial }: { initial: ProfileFieldRow[] }) {
  const [fields, setFields] = React.useState(initial);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);

  const labelOf = React.useCallback(
    (key: string) => fields.find((field) => field.key === key)?.labelEn ?? key,
    [fields],
  );

  async function patchField(id: string, body: Record<string, unknown>) {
    setPendingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/profile-fields/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? "That could not be changed.");
        return false;
      }
      setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...json.data } : f)));
      return true;
    } catch {
      setError("That could not be changed. Check your connection and try again.");
      return false;
    } finally {
      setPendingId(null);
    }
  }

  const sections = React.useMemo(() => {
    const groups = new Map<string, ProfileFieldRow[]>();
    for (const field of [...fields].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const list = groups.get(field.section) ?? [];
      list.push(field);
      groups.set(field.section, list);
    }
    return groups;
  }, [fields]);

  const nextSortOrder = fields.reduce((highest, f) => Math.max(highest, f.sortOrder), 0) + 10;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-info-soft text-ink rounded-md p-3 text-sm">
        <strong>The questions built into the app are listed here too</strong>, so everything a
        parent is asked can be seen in one place. You can change their wording and mark them as
        medical now. Anything else you change about them is saved, but families will keep seeing the
        app&apos;s own version until the app is updated to follow this list.
      </div>

      {error ? (
        <div
          role="alert"
          className="bg-danger-soft text-danger rounded-md p-3 text-sm font-semibold"
        >
          {error}
        </div>
      ) : null}

      {[...sections.entries()].map(([section, rows]) => (
        <div key={section} className="flex flex-col gap-2">
          <h3 className="text-ink-subtle text-xs font-semibold tracking-wide uppercase">
            {section}
          </h3>
          {rows.map((field) => (
            <QuestionRow
              key={field.id}
              field={field}
              pending={pendingId === field.id}
              labelOf={labelOf}
              onPatch={(body) => patchField(field.id, body)}
            />
          ))}
        </div>
      ))}

      {showAdd ? (
        <AddQuestionForm
          sortOrder={nextSortOrder}
          onCancel={() => setShowAdd(false)}
          onCreated={(created) => {
            setFields((prev) => [...prev, created]);
            setShowAdd(false);
          }}
        />
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowAdd(true)}
          className="self-start"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add a question
        </Button>
      )}
    </div>
  );
}

function QuestionRow({
  field,
  pending,
  labelOf,
  onPatch,
}: {
  field: ProfileFieldRow;
  pending: boolean;
  labelOf: (key: string) => string;
  onPatch: (body: Record<string, unknown>) => Promise<boolean | undefined> | void;
}) {
  const core = field.builtIn && CORE_KEYS.includes(field.key);
  const checks = describeRules(field.fieldType, field.rules, { unit: field.unit, labelOf });
  const [editing, setEditing] = React.useState(false);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink font-medium">{field.labelEn}</span>
            <Badge tone="neutral">{TYPE_LABEL[field.fieldType]}</Badge>
            <Badge tone={field.builtIn ? "info" : "neutral"}>
              {field.builtIn ? "Built into the app" : "Added by you"}
            </Badge>
            <Badge tone={field.showOnSignup ? "success" : "neutral"}>
              {field.showOnSignup ? "Asked when signing up" : "Asked on the profile"}
            </Badge>
            {field.required ? <Badge tone="warning">Must be answered</Badge> : null}
            {field.isMedical ? <Badge tone="info">Medical</Badge> : null}
            {!field.active ? <Badge tone="neutral">Not being asked</Badge> : null}
          </div>

          {field.labelTa ? <p className="text-ink-muted text-sm">{field.labelTa}</p> : null}

          {field.showOnSignup && field.promptEn ? (
            <p className="text-ink-muted text-sm">
              Asked as: <em>&ldquo;{field.promptEn}&rdquo;</em>
            </p>
          ) : null}

          {field.fieldType === "CHOICE" && field.options ? (
            <p className="text-ink-muted text-sm">
              Choices: {field.options.map((option) => option.labelEn).join(", ")}
            </p>
          ) : null}

          {checks.length > 0 ? (
            <ul className="text-ink-muted mt-1 list-inside list-disc text-sm">
              {checks.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2">
          {pending ? <Loader2 className="text-ink-subtle size-4 animate-spin" aria-hidden="true" /> : null}

          <Toggle
            label="Must be answered"
            checked={field.required}
            disabled={pending || !field.active || core}
            locked={core}
            onChange={(checked) => onPatch({ required: checked })}
          />
          <Toggle
            label="Ask at sign-up"
            checked={field.showOnSignup}
            disabled={pending || core}
            locked={core}
            onChange={(checked) => onPatch({ showOnSignup: checked })}
          />
          <Toggle
            label="Medical"
            hint="Medical information can be used by calculators. Everything else never is."
            checked={field.isMedical}
            disabled={pending}
            onChange={(checked) => onPatch({ isMedical: checked })}
          />
          <Toggle
            label="Being asked"
            checked={field.active}
            disabled={pending || core}
            locked={core}
            onChange={(checked) => onPatch({ active: checked })}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing((value) => !value)}
            aria-expanded={editing}
          >
            <Pencil className="size-4" aria-hidden="true" />
            Wording
          </Button>
        </div>
      </div>

      {core ? (
        <p className="text-ink-subtle mt-2 flex items-center gap-1.5 text-sm">
          <Lock className="size-4" aria-hidden="true" />
          Needed to sign up, so this one is always asked, always required, and always asked at
          sign-up.
        </p>
      ) : null}

      {editing ? (
        <WordingForm
          field={field}
          onCancel={() => setEditing(false)}
          onSave={async (body) => {
            const ok = await onPatch(body);
            if (ok) setEditing(false);
          }}
        />
      ) : null}
    </Card>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  locked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  locked?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className="flex items-center gap-2 text-sm"
      title={locked ? "Fixed — sign-up cannot work without it." : hint}
    >
      <span className="text-ink-muted">{label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </label>
  );
}

/** Changing what a question says, without touching what it checks. */
function WordingForm({
  field,
  onCancel,
  onSave,
}: {
  field: ProfileFieldRow;
  onCancel: () => void;
  onSave: (body: Record<string, unknown>) => void | Promise<void>;
}) {
  const [labelEn, setLabelEn] = React.useState(field.labelEn);
  const [labelTa, setLabelTa] = React.useState(field.labelTa ?? "");
  const [promptEn, setPromptEn] = React.useState(field.promptEn ?? "");
  const [promptTa, setPromptTa] = React.useState(field.promptTa ?? "");

  return (
    <div className="border-line bg-surface-sunken mt-4 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name, in English" htmlFor={`wl-en-${field.id}`}>
          <Input
            id={`wl-en-${field.id}`}
            value={labelEn}
            onChange={(event) => setLabelEn(event.target.value)}
          />
        </Field>
        <Field label="Name, in Tamil" htmlFor={`wl-ta-${field.id}`}>
          <Input
            id={`wl-ta-${field.id}`}
            value={labelTa}
            onChange={(event) => setLabelTa(event.target.value)}
          />
        </Field>
        {field.showOnSignup ? (
          <>
            <Field
              label="Sign-up question, in English"
              htmlFor={`wp-en-${field.id}`}
              hint="The sentence the chat asks."
            >
              <Input
                id={`wp-en-${field.id}`}
                value={promptEn}
                onChange={(event) => setPromptEn(event.target.value)}
              />
            </Field>
            <Field label="Sign-up question, in Tamil" htmlFor={`wp-ta-${field.id}`}>
              <Input
                id={`wp-ta-${field.id}`}
                value={promptTa}
                onChange={(event) => setPromptTa(event.target.value)}
              />
            </Field>
          </>
        ) : null}
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!labelEn.trim()}
          onClick={() =>
            onSave({
              labelEn: labelEn.trim(),
              labelTa: labelTa.trim() || null,
              ...(field.showOnSignup
                ? { promptEn: promptEn.trim() || null, promptTa: promptTa.trim() || null }
                : {}),
            })
          }
        >
          Save wording
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** "Carbs per meal" → "carbsPerMeal": an identifier nobody has to invent. */
function keyFromLabel(label: string): string {
  const camel = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join("");
  const stem = /^[a-z]/.test(camel) ? camel : `question${camel}`;
  return stem.slice(0, 50) || `question${Date.now()}`;
}

function numberOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function AddQuestionForm({
  sortOrder,
  onCancel,
  onCreated,
}: {
  sortOrder: number;
  onCancel: () => void;
  onCreated: (field: ProfileFieldRow) => void;
}) {
  const [labelEn, setLabelEn] = React.useState("");
  const [labelTa, setLabelTa] = React.useState("");
  const [fieldType, setFieldType] = React.useState<ProfileFieldType>("TEXT");
  const [section, setSection] = React.useState("Additional details");
  const [required, setRequired] = React.useState(false);
  const [isMedical, setIsMedical] = React.useState(false);
  const [unit, setUnit] = React.useState("");

  const [showOnSignup, setShowOnSignup] = React.useState(false);
  const [promptEn, setPromptEn] = React.useState("");
  const [promptTa, setPromptTa] = React.useState("");

  // The checks, one set per kind of answer.
  const [minLength, setMinLength] = React.useState("");
  const [maxLength, setMaxLength] = React.useState("");
  const [lettersOnly, setLettersOnly] = React.useState(false);
  const [min, setMin] = React.useState("");
  const [max, setMax] = React.useState("");
  const [wholeNumber, setWholeNumber] = React.useState(false);
  const [notInFuture, setNotInFuture] = React.useState(false);
  const [maxAgeYears, setMaxAgeYears] = React.useState("");

  const [options, setOptions] = React.useState<ChoiceOption[]>([
    { value: "", labelEn: "", labelTa: "" },
  ]);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function buildRules(): Record<string, unknown> | null {
    if (fieldType === "TEXT") {
      return {
        minLength: numberOrNull(minLength),
        maxLength: numberOrNull(maxLength),
        format: lettersOnly ? "LETTERS" : null,
      };
    }
    if (fieldType === "NUMBER") {
      return { min: numberOrNull(min), max: numberOrNull(max), wholeNumber: wholeNumber || null };
    }
    if (fieldType === "DATE") {
      return { notInFuture: notInFuture || null, maxAgeYears: numberOrNull(maxAgeYears) };
    }
    return null;
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/profile-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: keyFromLabel(labelEn),
          fieldType,
          section: section.trim() || undefined,
          labelEn: labelEn.trim(),
          labelTa: labelTa.trim() || undefined,
          required,
          sortOrder,
          isMedical,
          unit: fieldType === "NUMBER" ? unit.trim() || undefined : undefined,
          showOnSignup,
          promptEn: showOnSignup ? promptEn.trim() || undefined : undefined,
          promptTa: showOnSignup ? promptTa.trim() || undefined : undefined,
          rules: buildRules(),
          options:
            fieldType === "CHOICE"
              ? options
                  .filter((o) => o.value.trim() && o.labelEn.trim())
                  .map((o) => ({
                    value: o.value.trim(),
                    labelEn: o.labelEn.trim(),
                    labelTa: o.labelTa?.trim() || undefined,
                    numericValue:
                      isMedical && o.numericValue != null && Number.isFinite(o.numericValue)
                        ? o.numericValue
                        : undefined,
                  }))
              : undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(
          response.status === 409
            ? "You already have a question with that name. Please word it a little differently."
            : (json?.error?.message ?? "That question could not be added."),
        );
        return;
      }
      onCreated(json.data);
    } catch {
      setError("That question could not be added. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <h3 className="text-ink font-semibold">Add a question</h3>

      {error ? (
        <p role="alert" className="text-danger text-sm font-semibold">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="The question, in English" htmlFor="aq-label-en" required>
          <Input
            id="aq-label-en"
            value={labelEn}
            placeholder="School name"
            onChange={(event) => setLabelEn(event.target.value)}
          />
        </Field>
        <Field label="The question, in Tamil (optional)" htmlFor="aq-label-ta">
          <Input id="aq-label-ta" value={labelTa} onChange={(e) => setLabelTa(e.target.value)} />
        </Field>

        <Field label="What kind of answer" htmlFor="aq-type">
          <select
            id="aq-type"
            className="border-line bg-surface text-ink h-10 w-full rounded-md border px-3 text-sm"
            value={fieldType}
            onChange={(event) => setFieldType(event.target.value as ProfileFieldType)}
          >
            {(Object.keys(TYPE_LABEL) as ProfileFieldType[]).map((type) => (
              <option key={type} value={type}>
                {TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Group it under" htmlFor="aq-section">
          <Input id="aq-section" value={section} onChange={(e) => setSection(e.target.value)} />
        </Field>
      </div>

      {/* The checks an answer must pass — only those that suit the kind of answer. */}
      {fieldType !== "CHOICE" ? (
        <fieldset className="border-line rounded-md border p-3">
          <legend className="text-ink px-1 text-sm font-medium">What counts as a good answer</legend>

          {fieldType === "TEXT" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Fewest characters" htmlFor="aq-minlen">
                <Input id="aq-minlen" value={minLength} inputMode="numeric" onChange={(e) => setMinLength(e.target.value)} />
              </Field>
              <Field label="Most characters" htmlFor="aq-maxlen">
                <Input id="aq-maxlen" value={maxLength} inputMode="numeric" onChange={(e) => setMaxLength(e.target.value)} />
              </Field>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <Switch checked={lettersOnly} onCheckedChange={setLettersOnly} />
                <span className="text-ink-muted">Letters only</span>
              </label>
            </div>
          ) : null}

          {fieldType === "NUMBER" ? (
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Lowest allowed" htmlFor="aq-min">
                <Input id="aq-min" value={min} inputMode="decimal" onChange={(e) => setMin(e.target.value)} />
              </Field>
              <Field label="Highest allowed" htmlFor="aq-max">
                <Input id="aq-max" value={max} inputMode="decimal" onChange={(e) => setMax(e.target.value)} />
              </Field>
              <Field label="Unit (kg, cm…)" htmlFor="aq-unit">
                <Input id="aq-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </Field>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <Switch checked={wholeNumber} onCheckedChange={setWholeNumber} />
                <span className="text-ink-muted">Whole numbers only</span>
              </label>
            </div>
          ) : null}

          {fieldType === "DATE" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={notInFuture} onCheckedChange={setNotInFuture} />
                <span className="text-ink-muted">Cannot be in the future</span>
              </label>
              <Field label="No more than … years ago" htmlFor="aq-maxage">
                <Input id="aq-maxage" value={maxAgeYears} inputMode="numeric" onChange={(e) => setMaxAgeYears(e.target.value)} />
              </Field>
            </div>
          ) : null}
        </fieldset>
      ) : (
        <fieldset className="border-line flex flex-col gap-2 rounded-md border p-3">
          <legend className="text-ink px-1 text-sm font-medium">The choices</legend>
          {isMedical ? (
            <p className="text-ink-muted text-sm">
              Because this is medical information, give each choice the number it should count as in
              a calculator — a sum cannot be done on a word. Leave them blank and this question
              simply will not appear in the calculator list.
            </p>
          ) : null}
          {options.map((option, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="What is stored"
                aria-label={`Choice ${i + 1}, stored value`}
                value={option.value}
                className="w-36"
                onChange={(e) =>
                  setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, value: e.target.value } : o)))
                }
              />
              <Input
                placeholder="English"
                aria-label={`Choice ${i + 1}, English`}
                value={option.labelEn}
                className="min-w-40 flex-1"
                onChange={(e) =>
                  setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, labelEn: e.target.value } : o)))
                }
              />
              <Input
                placeholder="Tamil (optional)"
                aria-label={`Choice ${i + 1}, Tamil`}
                value={option.labelTa ?? ""}
                className="min-w-40 flex-1"
                onChange={(e) =>
                  setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, labelTa: e.target.value } : o)))
                }
              />
              {isMedical ? (
                <Input
                  placeholder="counts as"
                  aria-label={`Choice ${i + 1}, counts as`}
                  inputMode="decimal"
                  value={option.numericValue ?? ""}
                  className="w-28"
                  onChange={(e) =>
                    setOptions((prev) =>
                      prev.map((o, idx) =>
                        idx === i
                          ? { ...o, numericValue: e.target.value.trim() === "" ? null : Number(e.target.value) }
                          : o,
                      ),
                    )
                  }
                />
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={options.length === 1}
                aria-label={`Remove choice ${i + 1}`}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setOptions((prev) => [...prev, { value: "", labelEn: "", labelTa: "" }])}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a choice
          </Button>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={required} onCheckedChange={setRequired} />
          <span className="text-ink-muted">Must be answered</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showOnSignup} onCheckedChange={setShowOnSignup} />
          <span className="text-ink-muted">Ask this when a parent signs up</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={isMedical} onCheckedChange={setIsMedical} />
          <span className="text-ink-muted">This is medical information about the child</span>
        </label>
      </div>

      {showOnSignup ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Sign-up question, in English"
            htmlFor="aq-prompt-en"
            hint="The sentence the sign-up chat asks, e.g. “Which school does your child attend?”"
          >
            <Input id="aq-prompt-en" value={promptEn} onChange={(e) => setPromptEn(e.target.value)} />
          </Field>
          <Field label="Sign-up question, in Tamil (optional)" htmlFor="aq-prompt-ta">
            <Input id="aq-prompt-ta" value={promptTa} onChange={(e) => setPromptTa(e.target.value)} />
          </Field>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button variant="primary" onClick={submit} disabled={saving || !labelEn.trim()}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Add question
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
