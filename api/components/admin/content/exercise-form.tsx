"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Save } from "lucide-react";

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

const CATEGORIES = [
  "AEROBIC",
  "STRENGTH",
  "FLEXIBILITY",
  "BALANCE",
  "BREATHING",
  "WALKING",
  "YOGA",
  "OTHER",
] as const;

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

interface ExerciseFormValue {
  id?: string;
  slug: string;
  title: string;
  description: string;
  category: (typeof CATEGORIES)[number];
  difficulty: (typeof DIFFICULTIES)[number];
  durationMinutes: string;
  instructions: string;
  equipment: string;
  precautions: string;
  status: (typeof STATUSES)[number];
  sortOrder: number;
}

const EMPTY: ExerciseFormValue = {
  slug: "",
  title: "",
  description: "",
  category: "AEROBIC",
  difficulty: "BEGINNER",
  durationMinutes: "",
  instructions: "",
  equipment: "",
  precautions: "",
  status: "DRAFT",
  sortOrder: 0,
};

/** Create/edit form for a guided exercise programme. */
export function ExerciseForm({
  initial,
  mode,
}: {
  initial?: ExerciseFormValue;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [value, setValue] = React.useState<ExerciseFormValue>(initial ?? EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");

  function set<K extends keyof ExerciseFormValue>(key: K, val: ExerciseFormValue[K]) {
    setValue((prev) => ({ ...prev, [key]: val }));
  }

  function setTitle(title: string) {
    setValue((prev) => ({
      ...prev,
      title,
      slug: mode === "create" && !slugTouched ? slugify(title) : prev.slug,
    }));
  }

  function setSlug(slug: string) {
    setSlugTouched(true);
    set("slug", slug);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const durationMinutes = Number(value.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      setFieldErrors({ durationMinutes: "Enter a whole number of minutes." });
      setSaving(false);
      return;
    }

    const payload = {
      slug: value.slug,
      title: value.title,
      description: value.description,
      category: value.category,
      difficulty: value.difficulty,
      durationMinutes,
      instructions: value.instructions,
      equipment: value.equipment
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
      precautions: value.precautions || undefined,
      status: value.status,
      sortOrder: value.sortOrder,
    };

    try {
      const url = mode === "create" ? "/api/admin/exercises" : `/api/admin/exercises/${value.id}`;
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not save this programme.");
        const issues: Record<string, string> = {};
        for (const issue of body?.error?.issues ?? []) {
          issues[issue.field] = issue.message;
        }
        setFieldErrors(issues);
        return;
      }

      router.push("/admin/content/exercises");
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
        <Field label="Title" htmlFor="ex-title" required error={fieldErrors.title}>
          <Input
            id="ex-title"
            value={value.title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={Boolean(fieldErrors.title)}
          />
        </Field>

        <Field
          label="Slug"
          htmlFor="ex-slug"
          required
          error={fieldErrors.slug}
          hint="Used in the mobile app's content bundle — cannot change after publishing."
        >
          <Input
            id="ex-slug"
            value={value.slug}
            onChange={(e) => setSlug(e.target.value)}
            aria-invalid={Boolean(fieldErrors.slug)}
            disabled={mode === "edit"}
          />
        </Field>

        <Field label="Description" htmlFor="ex-description" required error={fieldErrors.description}>
          <Textarea
            id="ex-description"
            rows={2}
            value={value.description}
            onChange={(e) => set("description", e.target.value)}
            aria-invalid={Boolean(fieldErrors.description)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Category" htmlFor="ex-category" required>
            <Select value={value.category} onValueChange={(v) => set("category", v as never)}>
              <SelectTrigger id="ex-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {humaniseEnum(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Difficulty" htmlFor="ex-difficulty" required>
            <Select value={value.difficulty} onValueChange={(v) => set("difficulty", v as never)}>
              <SelectTrigger id="ex-difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {humaniseEnum(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Duration (minutes)"
            htmlFor="ex-duration"
            required
            error={fieldErrors.durationMinutes}
          >
            <Input
              id="ex-duration"
              type="number"
              min={1}
              max={600}
              value={value.durationMinutes}
              onChange={(e) => set("durationMinutes", e.target.value)}
              aria-invalid={Boolean(fieldErrors.durationMinutes)}
            />
          </Field>
        </div>

        <Field
          label="Instructions"
          htmlFor="ex-instructions"
          required
          error={fieldErrors.instructions}
          hint="Step-by-step guidance shown to the participant."
        >
          <Textarea
            id="ex-instructions"
            rows={8}
            value={value.instructions}
            onChange={(e) => set("instructions", e.target.value)}
            aria-invalid={Boolean(fieldErrors.instructions)}
          />
        </Field>

        <Field
          label="Equipment"
          htmlFor="ex-equipment"
          hint='Comma-separated, e.g. "mat, water bottle". Leave blank if none needed.'
        >
          <Input
            id="ex-equipment"
            value={value.equipment}
            onChange={(e) => set("equipment", e.target.value)}
          />
        </Field>

        <Field
          label="Precautions"
          htmlFor="ex-precautions"
          hint="Safety notes shown before a participant starts — optional."
        >
          <Textarea
            id="ex-precautions"
            rows={3}
            value={value.precautions}
            onChange={(e) => set("precautions", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status" htmlFor="ex-status">
            <Select value={value.status} onValueChange={(v) => set("status", v as never)}>
              <SelectTrigger id="ex-status">
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

          <Field label="Sort order" htmlFor="ex-sort">
            <Input
              id="ex-sort"
              type="number"
              min={0}
              value={value.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
            />
          </Field>
        </div>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="size-4" aria-hidden="true" />
        )}
        {mode === "create" ? "Create programme" : "Save changes"}
      </Button>
    </div>
  );
}
