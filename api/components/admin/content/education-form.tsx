"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, Loader2, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEGACY_EDUCATION_CATEGORIES,
  STUDY_EDUCATION_CATEGORIES,
} from "@/lib/config/study-scope";
import { humaniseEnum } from "@/lib/utils/format";
import { slugify } from "@/lib/utils/sanitize-core";
import { TransliterateInput, TransliterateTextarea } from "./transliterate-field";

const CATEGORIES = [...STUDY_EDUCATION_CATEGORIES, ...LEGACY_EDUCATION_CATEGORIES] as const;

const LOCALES = ["EN", "TA"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export interface EducationFormValue {
  id?: string;
  slug: string;
  locale: (typeof LOCALES)[number];
  title: string;
  description: string;
  excerpt: string;
  category: (typeof CATEGORIES)[number];
  bodySource: string;
  status: (typeof STATUSES)[number];
  tags: string;
  sortOrder: number;
}

const EMPTY: EducationFormValue = {
  slug: "",
  locale: "EN",
  title: "",
  description: "",
  excerpt: "",
  category: STUDY_EDUCATION_CATEGORIES[0],
  bodySource: "",
  status: "DRAFT",
  tags: "",
  sortOrder: 0,
};

/**
 * Create/edit form for education content. Authors in Markdown — see
 * lib/utils/markdown.ts for why: CommonMark+GFM can't produce anything the
 * server's HTML sanitiser would strip, so the live preview below renders
 * exactly the bytes a participant would receive, via the same
 * /api/admin/content/preview endpoint the server uses on save.
 */
export function EducationForm({
  initial,
  mode,
}: {
  initial?: EducationFormValue;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [value, setValue] = React.useState<EducationFormValue>(initial ?? EMPTY);
  const [preview, setPreview] = React.useState<string>("");
  const [previewPending, setPreviewPending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  // Once the author edits the slug by hand, stop overwriting it from the
  // title — otherwise a deliberate slug tweak would keep getting clobbered
  // on every keystroke in the Title field.
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");
  // Off by default for the Markdown body: transliteration intercepts word
  // boundaries to convert them, and Markdown syntax (##, **, -, |) sits
  // right up against those boundaries — an editor writing plain Tamil prose
  // wants this on, but flip it off before pasting/writing raw Markdown.
  const [transliterateBody, setTransliterateBody] = React.useState(false);

  function set<K extends keyof EducationFormValue>(key: K, val: EducationFormValue[K]) {
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

  async function handlePreview() {
    setPreviewPending(true);
    try {
      const response = await fetch("/api/admin/content/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodySource: value.bodySource, bodyFormat: "MARKDOWN" }),
      });
      const body = await response.json();
      setPreview(response.ok ? body.data.html : "Preview failed.");
    } catch {
      setPreview("Preview failed.");
    } finally {
      setPreviewPending(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      slug: value.slug,
      ...(mode === "create" ? { locale: value.locale } : {}),
      title: value.title,
      description: value.description || undefined,
      excerpt: value.excerpt || undefined,
      category: value.category,
      body: "<p></p>", // placeholder; server derives body from bodySource+bodyFormat
      bodySource: value.bodySource,
      bodyFormat: "MARKDOWN",
      status: value.status,
      tags: value.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      sortOrder: value.sortOrder,
    };

    try {
      const url = mode === "create" ? "/api/admin/education" : `/api/admin/education/${value.id}`;
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not save this article.");
        const issues: Record<string, string> = {};
        for (const issue of body?.error?.issues ?? []) {
          issues[issue.field] = issue.message;
        }
        setFieldErrors(issues);
        return;
      }

      router.push("/admin/content/education");
      router.refresh();
    } catch {
      setError("Could not save this article. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div
          role="alert"
          className="bg-danger-soft text-danger flex items-start gap-2 rounded-md p-3 text-[13px]"
        >
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slug" htmlFor="slug" error={fieldErrors.slug} required>
            <Input
              value={value.slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={mode === "edit"}
              placeholder="insulin-basics"
            />
          </Field>

          <Field label="Language" htmlFor="locale">
            <Select
              value={value.locale}
              onValueChange={(v) => set("locale", v as EducationFormValue["locale"])}
              disabled={mode === "edit"}
            >
              <SelectTrigger id="locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l === "EN" ? "English" : "Tamil"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label={value.locale === "TA" ? "Title (type in English, transliterates to Tamil)" : "Title"}
            htmlFor="title"
            error={fieldErrors.title}
            required
            className="sm:col-span-2"
          >
            {value.locale === "TA" ? (
              <TransliterateInput id="title" value={value.title} onChangeText={setTitle} />
            ) : (
              <Input id="title" value={value.title} onChange={(e) => setTitle(e.target.value)} />
            )}
          </Field>

          <Field label="Category" htmlFor="category">
            <Select value={value.category} onValueChange={(v) => set("category", v as EducationFormValue["category"])}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>This study&apos;s curriculum</SelectLabel>
                  {STUDY_EDUCATION_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {humaniseEnum(c)}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Other (not used by this study)</SelectLabel>
                  {LEGACY_EDUCATION_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {humaniseEnum(c)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Status" htmlFor="status">
            <Select value={value.status} onValueChange={(v) => set("status", v as EducationFormValue["status"])}>
              <SelectTrigger id="status">
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

          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            {value.locale === "TA" ? (
              <TransliterateTextarea
                id="description"
                value={value.description}
                onChangeText={(text) => set("description", text)}
                rows={2}
              />
            ) : (
              <Textarea
                id="description"
                value={value.description}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
              />
            )}
          </Field>

          <Field label="Tags (comma-separated)" htmlFor="tags">
            <Input value={value.tags} onChange={(e) => set("tags", e.target.value)} />
          </Field>

          <Field label="Sort order" htmlFor="sortOrder">
            <Input
              type="number"
              value={value.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value))}
            />
          </Field>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-ink text-sm font-semibold">Body (Markdown)</h2>
            <div className="flex items-center gap-2">
              {value.locale === "TA" ? (
                <Button
                  type="button"
                  size="sm"
                  variant={transliterateBody ? "primary" : "secondary"}
                  onClick={() => setTransliterateBody((v) => !v)}
                  title="Type English words, they convert to Tamil script. Turn off before pasting or writing raw Markdown symbols."
                >
                  {transliterateBody ? "Transliterating: EN→TA" : "Transliterate: off"}
                </Button>
              ) : null}
              <Badge tone="neutral">CommonMark + GFM</Badge>
            </div>
          </div>
          {value.locale === "TA" && transliterateBody ? (
            <TransliterateTextarea
              value={value.bodySource}
              onChangeText={(text) => set("bodySource", text)}
              rows={20}
              className="font-mono text-[13px]"
              placeholder="## Section heading&#10;&#10;Body text."
            />
          ) : (
            <Textarea
              value={value.bodySource}
              onChange={(e) => set("bodySource", e.target.value)}
              rows={20}
              className="font-mono text-[13px]"
              placeholder={"## Section heading\n\nBody text. **Bold**, lists, tables, and images all work."}
            />
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-ink text-sm font-semibold">Preview</h2>
            <Button size="sm" variant="secondary" onClick={handlePreview} disabled={previewPending}>
              {previewPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
              Render
            </Button>
          </div>
          <div
            className="prose prose-sm max-w-none"
            // The preview endpoint returns sanitised HTML — the exact bytes a
            // participant would receive for this bodySource.
            dangerouslySetInnerHTML={{ __html: preview || "<p><em>Click Render to preview.</em></p>" }}
          />
        </Card>
      </div>

      <div>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {mode === "create" ? "Create article" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
