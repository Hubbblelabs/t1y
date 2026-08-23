"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus, Save, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { humaniseEnum } from "@/lib/utils/format";
import { slugify } from "@/lib/utils/sanitize-core";

const LOCALES = ["EN", "TA"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const QUESTION_TYPES = ["SINGLE_CHOICE", "TRUE_FALSE", "MATCHING", "ORDERING"] as const;
type QuestionType = (typeof QUESTION_TYPES)[number];

interface OptionValue {
  text: string;
  matchText: string;
  isCorrect: boolean;
}

interface QuestionValue {
  key: string; // client-side React key, not sent
  questionKey: string;
  prompt: string;
  explanation: string;
  points: number;
  type: QuestionType;
  options: OptionValue[];
}

interface QuizFormValue {
  id?: string;
  slug: string;
  locale: (typeof LOCALES)[number];
  title: string;
  description: string;
  passingScore: string;
  status: (typeof STATUSES)[number];
  questions: QuestionValue[];
}

let nextKey = 0;
function freshOption(): OptionValue {
  return { text: "", matchText: "", isCorrect: false };
}
function freshQuestion(): QuestionValue {
  return {
    key: `q${nextKey++}`,
    questionKey: "",
    prompt: "",
    explanation: "",
    points: 1,
    type: "SINGLE_CHOICE",
    options: [freshOption(), freshOption()],
  };
}

const EMPTY: QuizFormValue = {
  slug: "",
  locale: "EN",
  title: "",
  description: "",
  passingScore: "",
  status: "DRAFT",
  questions: [freshQuestion()],
};

/**
 * Create/edit form for a quiz. Every question type carries the invariant
 * that makes it gradable (see lib/validation/quizzes.ts's own comment) —
 * this form enforces the same rules client-side so a save attempt fails
 * fast with a specific message instead of a generic 400.
 */
export function QuizForm({ initial, mode }: { initial?: QuizFormValue; mode: "create" | "edit" }) {
  const router = useRouter();
  const [value, setValue] = React.useState<QuizFormValue>(initial ?? EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [questionErrors, setQuestionErrors] = React.useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");

  function set<K extends keyof QuizFormValue>(key: K, val: QuizFormValue[K]) {
    setValue((prev) => ({ ...prev, [key]: val }));
  }

  function setTitle(title: string) {
    setValue((prev) => ({
      ...prev,
      title,
      slug: mode === "create" && !slugTouched ? slugify(title) : prev.slug,
    }));
  }

  function updateQuestion(key: string, patch: Partial<QuestionValue>) {
    setValue((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    }));
  }

  function setQuestionType(key: string, type: QuestionType) {
    const optionCount = type === "TRUE_FALSE" ? 2 : 2;
    updateQuestion(key, {
      type,
      options:
        type === "TRUE_FALSE"
          ? [
              { text: "True", matchText: "", isCorrect: true },
              { text: "False", matchText: "", isCorrect: false },
            ]
          : Array.from({ length: optionCount }, freshOption),
    });
  }

  function updateOption(qKey: string, index: number, patch: Partial<OptionValue>) {
    setValue((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.key !== qKey) return q;
        const options = q.options.map((o, i) => (i === index ? { ...o, ...patch } : o));
        // Single-choice/true-false: exactly one correct option.
        if ((q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") && patch.isCorrect) {
          return { ...q, options: options.map((o, i) => ({ ...o, isCorrect: i === index })) };
        }
        return { ...q, options };
      }),
    }));
  }

  function addOption(qKey: string) {
    setValue((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.key === qKey && q.options.length < 10 ? { ...q, options: [...q.options, freshOption()] } : q,
      ),
    }));
  }

  function removeOption(qKey: string, index: number) {
    setValue((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.key === qKey && q.options.length > 2
          ? { ...q, options: q.options.filter((_, i) => i !== index) }
          : q,
      ),
    }));
  }

  function addQuestion() {
    setValue((prev) => ({ ...prev, questions: [...prev.questions, freshQuestion()] }));
  }

  function removeQuestion(key: string) {
    setValue((prev) => ({
      ...prev,
      questions: prev.questions.length > 1 ? prev.questions.filter((q) => q.key !== key) : prev.questions,
    }));
  }

  /** Mirrors the backend's per-type invariants — see quizQuestionSchema. */
  function validateQuestions(): { ok: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    for (const q of value.questions) {
      if (!q.questionKey.trim()) {
        errors[q.key] = "Question key is required.";
        continue;
      }
      if (!/^[a-z0-9-]+$/.test(q.questionKey.trim())) {
        errors[q.key] = "Question key must be lowercase letters, numbers and hyphens only.";
        continue;
      }
      if (!q.prompt.trim()) {
        errors[q.key] = "Prompt is required.";
        continue;
      }
      if (q.options.some((o) => !o.text.trim())) {
        errors[q.key] = "Every option needs text.";
        continue;
      }
      if (q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") {
        const correct = q.options.filter((o) => o.isCorrect).length;
        if (correct !== 1) {
          errors[q.key] = `Mark exactly one correct option (currently ${correct}).`;
          continue;
        }
      }
      if (q.type === "MATCHING" && q.options.some((o) => !o.matchText.trim())) {
        errors[q.key] = "Every option needs a match value.";
        continue;
      }
    }
    return { ok: Object.keys(errors).length === 0, errors };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setQuestionErrors({});

    const { ok, errors } = validateQuestions();
    if (!ok) {
      setQuestionErrors(errors);
      setError("Fix the highlighted question(s) before saving.");
      setSaving(false);
      return;
    }

    const questions = value.questions.map((q, position) => ({
      type: q.type,
      questionKey: q.questionKey.trim(),
      prompt: q.prompt.trim(),
      explanation: q.explanation.trim() || undefined,
      points: q.points,
      position,
      options: q.options.map((o, index) => ({
        text: o.text.trim(),
        matchText: q.type === "MATCHING" ? o.matchText.trim() : undefined,
        isCorrect: q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE" ? o.isCorrect : undefined,
        // ORDERING: the order the admin listed options in IS the correct order.
        correctPosition: q.type === "ORDERING" ? index + 1 : undefined,
      })),
    }));

    const passingScore = value.passingScore.trim() === "" ? null : Number(value.passingScore);

    const payload = {
      slug: value.slug,
      ...(mode === "create" ? { locale: value.locale } : {}),
      title: value.title,
      description: value.description || undefined,
      passingScore,
      status: value.status,
      questions,
    };

    try {
      const url = mode === "create" ? "/api/admin/quizzes" : `/api/admin/quizzes/${value.id}`;
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not save this quiz.");
        return;
      }

      router.push("/admin/content/quizzes");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="bg-danger-soft text-danger flex items-start gap-2 rounded-md p-3 text-[13px]"
        >
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <Card className="space-y-4 p-5">
        <Field label="Title" htmlFor="quiz-title" required>
          <Input id="quiz-title" value={value.title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <Field
          label="Slug"
          htmlFor="quiz-slug"
          required
          hint="Cannot change after creation."
        >
          <Input
            id="quiz-slug"
            value={value.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value);
            }}
            disabled={mode === "edit"}
          />
        </Field>

        <Field label="Description" htmlFor="quiz-description">
          <Textarea
            id="quiz-description"
            rows={2}
            value={value.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Language" htmlFor="quiz-locale">
            <Select
              value={value.locale}
              onValueChange={(v) => set("locale", v as never)}
              disabled={mode === "edit"}
            >
              <SelectTrigger id="quiz-locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Status" htmlFor="quiz-status">
            <Select value={value.status} onValueChange={(v) => set("status", v as never)}>
              <SelectTrigger id="quiz-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {humaniseEnum(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Passing score (%)"
            htmlFor="quiz-passing"
            hint="Blank = no pass/fail threshold"
            className="sm:col-span-2"
          >
            <Input
              id="quiz-passing"
              type="number"
              min={0}
              max={100}
              value={value.passingScore}
              onChange={(e) => set("passingScore", e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <div className="space-y-4">
        <h2 className="text-ink text-sm font-semibold">Questions</h2>
        {value.questions.map((q, qIndex) => (
          <QuestionEditor
            key={q.key}
            index={qIndex}
            question={q}
            error={questionErrors[q.key]}
            onUpdate={(patch) => updateQuestion(q.key, patch)}
            onTypeChange={(type) => setQuestionType(q.key, type)}
            onUpdateOption={(i, patch) => updateOption(q.key, i, patch)}
            onAddOption={() => addOption(q.key)}
            onRemoveOption={(i) => removeOption(q.key, i)}
            onRemove={() => removeQuestion(q.key)}
            canRemove={value.questions.length > 1}
          />
        ))}

        <Button variant="secondary" onClick={addQuestion}>
          <Plus className="size-4" aria-hidden="true" />
          Add question
        </Button>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="size-4" aria-hidden="true" />
        )}
        {mode === "create" ? "Create quiz" : "Save changes"}
      </Button>
    </div>
  );
}

function QuestionEditor({
  index,
  question,
  error,
  onUpdate,
  onTypeChange,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  onRemove,
  canRemove,
}: {
  index: number;
  question: QuestionValue;
  error?: string;
  onUpdate: (patch: Partial<QuestionValue>) => void;
  onTypeChange: (type: QuestionType) => void;
  onUpdateOption: (index: number, patch: Partial<OptionValue>) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const isSingleCorrect = question.type === "SINGLE_CHOICE" || question.type === "TRUE_FALSE";
  const isOrdering = question.type === "ORDERING";
  const isMatching = question.type === "MATCHING";
  const fixedOptions = question.type === "TRUE_FALSE";

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="neutral">Q{index + 1}</Badge>
          {error ? <span className="text-danger text-xs">{error}</span> : null}
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} disabled={!canRemove} title="Remove question">
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Type" htmlFor={`${question.key}-type`} className="sm:col-span-1">
          <Select value={question.type} onValueChange={(v) => onTypeChange(v as QuestionType)}>
            <SelectTrigger id={`${question.key}-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {humaniseEnum(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Question key"
          htmlFor={`${question.key}-key`}
          hint="lowercase-with-hyphens"
          className="sm:col-span-2"
        >
          <Input
            id={`${question.key}-key`}
            value={question.questionKey}
            onChange={(e) => onUpdate({ questionKey: e.target.value })}
          />
        </Field>

        <Field label="Points" htmlFor={`${question.key}-points`}>
          <Input
            id={`${question.key}-points`}
            type="number"
            min={1}
            max={20}
            value={question.points}
            onChange={(e) => onUpdate({ points: Number(e.target.value) || 1 })}
          />
        </Field>
      </div>

      <Field label="Prompt" htmlFor={`${question.key}-prompt`} required>
        <Textarea
          id={`${question.key}-prompt`}
          rows={2}
          value={question.prompt}
          onChange={(e) => onUpdate({ prompt: e.target.value })}
        />
      </Field>

      <Field label="Explanation" htmlFor={`${question.key}-explanation`} hint="Shown after answering — optional">
        <Textarea
          id={`${question.key}-explanation`}
          rows={2}
          value={question.explanation}
          onChange={(e) => onUpdate({ explanation: e.target.value })}
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-ink-muted text-xs font-medium">
            {isOrdering
              ? "Steps, in the correct order"
              : isMatching
                ? "Items to match"
                : "Options"}
          </p>
          {!fixedOptions && (
            <Button variant="ghost" size="sm" onClick={onAddOption} disabled={question.options.length >= 10}>
              <Plus className="size-3.5" aria-hidden="true" />
              Add option
            </Button>
          )}
        </div>

        {question.options.map((option, i) => (
          <div key={i} className="flex items-center gap-2">
            {isOrdering ? (
              <span className="text-ink-subtle w-5 shrink-0 text-xs tabular">{i + 1}.</span>
            ) : isSingleCorrect ? (
              <input
                type="radio"
                name={`${question.key}-correct`}
                checked={option.isCorrect}
                onChange={() => onUpdateOption(i, { isCorrect: true })}
                disabled={fixedOptions}
                className="size-4 shrink-0"
                aria-label="Correct option"
              />
            ) : null}

            <Input
              value={option.text}
              onChange={(e) => onUpdateOption(i, { text: e.target.value })}
              placeholder={isOrdering ? `Step ${i + 1}` : "Option text"}
              disabled={fixedOptions}
              className="flex-1"
            />

            {isMatching ? (
              <Input
                value={option.matchText}
                onChange={(e) => onUpdateOption(i, { matchText: e.target.value })}
                placeholder="Matches with…"
                className="flex-1"
              />
            ) : null}

            {!fixedOptions ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveOption(i)}
                disabled={question.options.length <= 2}
                title="Remove option"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            ) : (
              <span className="w-9" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
