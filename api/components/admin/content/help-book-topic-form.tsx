"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Film,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Type,
} from "lucide-react";

import { PicturePicker, VideoPicker } from "@/components/admin/content/media-picker";
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
import { TransliterateInput, TransliterateTextarea } from "./transliterate-field";

const CATEGORIES = [...STUDY_EDUCATION_CATEGORIES, ...LEGACY_EDUCATION_CATEGORIES] as const;

type BlockKind = "TEXT" | "IMAGE" | "VIDEO";

export interface TopicBlock {
  kind: BlockKind;
  heading: string;
  paragraph: string;
  imageUrl: string | null;
  imageKey: string | null;
  videoUrl: string | null;
}

export interface TopicFormValue {
  id?: string;
  slug?: string;
  locale: "EN" | "TA";
  title: string;
  description: string;
  category: (typeof CATEGORIES)[number];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  thumbnailUrl: string | null;
  blocks: TopicBlock[];
}

/**
 * Plain-language names for what the database calls a ContentStatus. A
 * coordinator deciding whether families can read something does not think in
 * terms of "DRAFT" and "ARCHIVED".
 */
const STATUS_OPTIONS: Array<{ value: TopicFormValue["status"]; label: string; hint: string }> = [
  { value: "DRAFT", label: "Not finished", hint: "Only you can see it" },
  { value: "PUBLISHED", label: "Live in the app", hint: "Families can read it now" },
  { value: "ARCHIVED", label: "Hidden", hint: "Taken out of the app, kept here" },
];

const BLOCK_KINDS: Array<{ value: BlockKind; label: string; icon: typeof Type }> = [
  { value: "TEXT", label: "Words only", icon: Type },
  { value: "IMAGE", label: "Picture", icon: ImageIcon },
  { value: "VIDEO", label: "Video", icon: Film },
];

function emptyBlock(kind: BlockKind): TopicBlock {
  return { kind, heading: "", paragraph: "", imageUrl: null, imageKey: null, videoUrl: null };
}

/**
 * Create/edit screen for one language of one Help Book topic.
 *
 * A topic is built out of blocks in the order families will scroll through
 * them, and each block is one of three obvious things — some words, a
 * picture, or a video. This replaced a Markdown editor: the people writing
 * this material are nurses and coordinators, and asking them to remember
 * that `##` means a heading put a needless obstacle between them and the
 * content. Nothing here needs to be learned; what the form shows is what the
 * phone shows.
 *
 * The topic's identity (its slug) is never shown. On a new topic the server
 * mints one; when adding a second language, it is carried in from the list
 * screen so the two versions pair up.
 */
export function HelpBookTopicForm({
  initial,
  mode,
  addingLanguageTo,
  storageConfigured = true,
}: {
  initial?: TopicFormValue;
  mode: "create" | "edit";
  /** Set when this is the second language of an existing topic. */
  addingLanguageTo?: { slug: string; language: "EN" | "TA" };
  /**
   * Whether Cloudinary is configured (see lib/env.ts's isStorageConfigured).
   * When it isn't, an uploaded picture or video is only ever saved for local
   * development — it will not appear for a real family — so this is shown
   * before publishing, not discovered after.
   */
  storageConfigured?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState<TopicFormValue>(
    initial ?? {
      slug: addingLanguageTo?.slug,
      locale: addingLanguageTo?.language ?? "EN",
      title: "",
      description: "",
      category: STUDY_EDUCATION_CATEGORIES[0],
      status: "DRAFT",
      thumbnailUrl: null,
      blocks: [emptyBlock("TEXT")],
    },
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const tamil = value.locale === "TA";

  function set<K extends keyof TopicFormValue>(key: K, next: TopicFormValue[K]) {
    setValue((prev) => ({ ...prev, [key]: next }));
  }

  function updateBlock(index: number, patch: Partial<TopicBlock>) {
    setValue((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    }));
  }

  function addBlock(kind: BlockKind) {
    setValue((prev) => ({ ...prev, blocks: [...prev.blocks, emptyBlock(kind)] }));
  }

  function removeBlock(index: number) {
    setValue((prev) => ({ ...prev, blocks: prev.blocks.filter((_, i) => i !== index) }));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.blocks.length) return;
    setValue((prev) => {
      const blocks = [...prev.blocks];
      const [moved] = blocks.splice(index, 1);
      blocks.splice(target, 0, moved);
      return { ...prev, blocks };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setFieldErrors({});

    // Blocks the author started and left completely empty are dropped rather
    // than rejected — an empty last block is how the form looks the moment
    // someone clicks "Add", not a mistake worth an error message.
    const blocks = value.blocks
      .filter(
        (block) =>
          block.paragraph.trim() || block.heading.trim() || block.imageUrl || block.videoUrl,
      )
      .map((block) => ({
        kind: block.kind,
        heading: block.heading.trim() || null,
        paragraph: block.paragraph,
        imageUrl: block.kind === "IMAGE" ? block.imageUrl : null,
        imageKey: block.kind === "IMAGE" ? block.imageKey : null,
        videoUrl: block.kind === "VIDEO" ? block.videoUrl : null,
      }));

    if (blocks.length === 0) {
      setSaving(false);
      setError("Add at least some words, a picture or a video before saving.");
      return;
    }

    const payload = {
      ...(value.slug ? { slug: value.slug } : {}),
      ...(mode === "create" ? { locale: value.locale } : {}),
      title: value.title,
      description: value.description || undefined,
      category: value.category,
      status: value.status,
      thumbnailUrl: value.thumbnailUrl,
      contentBlocks: blocks,
      bodyFormat: "HTML" as const,
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
        setError(body?.error?.message ?? "This topic could not be saved.");
        const issues: Record<string, string> = {};
        for (const issue of body?.error?.issues ?? []) issues[issue.field] = issue.message;
        setFieldErrors(issues);
        return;
      }

      router.push("/admin/content/education");
      router.refresh();
    } catch {
      setError("This topic could not be saved. Check your connection and try again.");
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

      {!storageConfigured ? (
        <p className="bg-warning-soft text-warning rounded-md px-3 py-2 text-sm">
          Picture and video uploads are not connected yet — anything you add here is only visible
          on this computer, not to families. Set up Cloudinary before publishing a topic with
          media (see the technical setup notes).
        </p>
      ) : null}

      {addingLanguageTo ? (
        <p className="bg-info-soft text-info rounded-md px-3 py-2 text-sm">
          You are adding the {addingLanguageTo.language === "TA" ? "Tamil" : "English"} version of a
          topic that already exists. Families will see whichever version matches the language they
          chose.
        </p>
      ) : null}

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={tamil ? "Title (type in English, it becomes Tamil)" : "Title"}
            htmlFor="title"
            error={fieldErrors.title}
            required
            className="sm:col-span-2"
          >
            {tamil ? (
              <TransliterateInput
                id="title"
                value={value.title}
                onChangeText={(text) => set("title", text)}
              />
            ) : (
              <Input
                id="title"
                value={value.title}
                onChange={(event) => set("title", event.target.value)}
              />
            )}
          </Field>

          {mode === "create" && !addingLanguageTo ? (
            <Field label="Language" htmlFor="locale">
              <Select
                value={value.locale}
                onValueChange={(next) => set("locale", next as TopicFormValue["locale"])}
              >
                <SelectTrigger id="locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EN">English</SelectItem>
                  <SelectItem value="TA">Tamil</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field label="Section" htmlFor="category">
            <Select
              value={value.category}
              onValueChange={(next) => set("category", next as TopicFormValue["category"])}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Used by this study</SelectLabel>
                  {STUDY_EDUCATION_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {humaniseEnum(category)}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Other</SelectLabel>
                  {LEGACY_EDUCATION_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {humaniseEnum(category)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Who can see it" htmlFor="status">
            <Select
              value={value.status}
              onValueChange={(next) => set("status", next as TopicFormValue["status"])}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} — {option.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Short summary (shown under the title)"
            htmlFor="description"
            className="sm:col-span-2"
          >
            {tamil ? (
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
                onChange={(event) => set("description", event.target.value)}
                rows={2}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-ink mb-1 font-semibold">Main picture</h2>
        <p className="text-ink-muted mb-3 text-sm">
          Shown on the topic&apos;s card in the app. If a section below has no picture of its own,
          this one is used there too.
        </p>
        <div className="max-w-sm">
          <PicturePicker
            url={value.thumbnailUrl}
            purpose="education-thumbnail"
            label="main picture"
            onChange={(result) => set("thumbnailUrl", result?.url ?? null)}
          />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-ink mb-1 font-semibold">The topic, section by section</h2>
        <p className="text-ink-muted mb-4 text-sm">
          Families scroll through these in order. Each section can be some words, a picture or a
          video.
        </p>

        <div className="space-y-3">
          {value.blocks.map((block, index) => (
            <BlockEditor
              key={index}
              block={block}
              index={index}
              total={value.blocks.length}
              tamil={tamil}
              onChange={(patch) => updateBlock(index, patch)}
              onMove={(direction) => moveBlock(index, direction)}
              onRemove={() => removeBlock(index)}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {BLOCK_KINDS.map((kind) => (
            <Button key={kind.value} variant="secondary" size="sm" onClick={() => addBlock(kind.value)}>
              <Plus className="size-4" aria-hidden="true" />
              Add {kind.label.toLowerCase()}
            </Button>
          ))}
        </div>
      </Card>

      <div>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {mode === "create" ? "Create topic" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  index,
  total,
  tamil,
  onChange,
  onMove,
  onRemove,
}: {
  block: TopicBlock;
  index: number;
  total: number;
  tamil: boolean;
  onChange: (patch: Partial<TopicBlock>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const kind = BLOCK_KINDS.find((candidate) => candidate.value === block.kind) ?? BLOCK_KINDS[0];
  const Icon = kind.icon;

  return (
    <div className="border-line rounded-md border">
      <div className="border-line bg-surface-sunken flex items-center gap-2 border-b px-3 py-2">
        <Icon className="text-ink-muted size-4" aria-hidden="true" />
        <span className="text-ink text-sm font-medium">
          Section {index + 1} · {kind.label}
        </span>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label={`Move section ${index + 1} up`}
          title="Move up"
        >
          <ChevronUp className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          aria-label={`Move section ${index + 1} down`}
          title="Move down"
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove section ${index + 1}`}
          title="Remove this section"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-3 p-3">
        <Field label="Heading for this section (optional)" htmlFor={`heading-${index}`}>
          {tamil ? (
            <TransliterateInput
              id={`heading-${index}`}
              value={block.heading}
              onChangeText={(text) => onChange({ heading: text })}
            />
          ) : (
            <Input
              id={`heading-${index}`}
              value={block.heading}
              onChange={(event) => onChange({ heading: event.target.value })}
            />
          )}
        </Field>

        {block.kind === "IMAGE" ? (
          <div className="max-w-sm">
            <PicturePicker
              url={block.imageUrl}
              onChange={(result) =>
                onChange({ imageUrl: result?.url ?? null, imageKey: result?.key ?? null })
              }
            />
          </div>
        ) : null}

        {block.kind === "VIDEO" ? (
          <div className="max-w-md">
            <VideoPicker url={block.videoUrl} onChange={(result) => onChange({ videoUrl: result?.url ?? null })} />
          </div>
        ) : null}

        <Field
          label={
            block.kind === "TEXT"
              ? "What it says"
              : `Words shown with this ${block.kind === "IMAGE" ? "picture" : "video"} (optional)`
          }
          htmlFor={`paragraph-${index}`}
        >
          {tamil ? (
            <TransliterateTextarea
              id={`paragraph-${index}`}
              value={block.paragraph}
              onChangeText={(text) => onChange({ paragraph: text })}
              rows={block.kind === "TEXT" ? 5 : 3}
            />
          ) : (
            <Textarea
              id={`paragraph-${index}`}
              value={block.paragraph}
              onChange={(event) => onChange({ paragraph: event.target.value })}
              rows={block.kind === "TEXT" ? 5 : 3}
            />
          )}
        </Field>
      </div>
    </div>
  );
}
