"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, GripVertical, Loader2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface TopicVersionRow {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  thumbnailUrl: string | null;
  viewCount: number;
  blockCount: number;
}

export interface TopicRow {
  slug: string;
  category: string;
  displayTitle: string;
  versions: { EN: TopicVersionRow | null; TA: TopicVersionRow | null };
}

const LANGUAGE_NAME = { EN: "English", TA: "Tamil" } as const;
type Language = keyof typeof LANGUAGE_NAME;

const STATUS_LABEL = {
  PUBLISHED: "Live",
  DRAFT: "Not finished",
  ARCHIVED: "Hidden",
} as const;

/**
 * The Help Book, as one row per topic.
 *
 * Order here is the order families scroll through on their phones, so it is
 * set by dragging rather than by typing position numbers into a field. Every
 * drag is also available as an up/down button: the people using this are as
 * likely to be on a trackpad they find fiddly as not, and drag-and-drop alone
 * is unusable by keyboard or screen reader.
 *
 * The new order is sent as soon as a row is dropped. There is no "save
 * order" button to forget to press — but the list is put back the way it was
 * if the request fails, so what is on screen is never a lie about what
 * families will see.
 */
export function HelpBookTopicList({ initial }: { initial: TopicRow[] }) {
  const [topics, setTopics] = React.useState(initial);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function persist(next: TopicRow[], previous: TopicRow[]) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/education/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((topic) => topic.slug) }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        setTopics(previous);
        setError(json?.error?.message ?? "The new order could not be saved.");
      }
    } catch {
      setTopics(previous);
      setError("The new order could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function move(slug: string, direction: -1 | 1) {
    const from = topics.findIndex((topic) => topic.slug === slug);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= topics.length) return;
    reorder(from, to);
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const previous = topics;
    const next = [...topics];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTopics(next);
    void persist(next, previous);
  }

  function onDrop(targetSlug: string) {
    if (!dragging || dragging === targetSlug) return;
    const from = topics.findIndex((topic) => topic.slug === dragging);
    const to = topics.findIndex((topic) => topic.slug === targetSlug);
    if (from >= 0 && to >= 0) reorder(from, to);
    setDragging(null);
    setDropTarget(null);
  }

  return (
    <div>
      <div className="text-ink-muted flex items-center gap-2 px-4 py-3 text-sm">
        <span>Drag a topic to change the order families see it in.</span>
        {saving ? (
          <span className="text-ink-subtle inline-flex items-center gap-1.5">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Saving order…
          </span>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="bg-danger-soft text-danger mx-4 mb-3 rounded-md px-3 py-2 text-sm font-semibold"
        >
          {error}
        </p>
      ) : null}

      <ul className="divide-line divide-y">
        {topics.map((topic, index) => (
          <li
            key={topic.slug}
            draggable
            onDragStart={() => setDragging(topic.slug)}
            onDragEnd={() => {
              setDragging(null);
              setDropTarget(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget(topic.slug);
            }}
            onDrop={(event) => {
              event.preventDefault();
              onDrop(topic.slug);
            }}
            className={[
              "flex items-center gap-3 px-4 py-3",
              dragging === topic.slug ? "opacity-40" : "",
              dropTarget === topic.slug && dragging && dragging !== topic.slug
                ? "border-primary border-t-2"
                : "",
            ].join(" ")}
          >
            <span
              className="text-ink-subtle cursor-grab active:cursor-grabbing"
              aria-hidden="true"
            >
              <GripVertical className="size-5" />
            </span>

            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="icon"
                disabled={index === 0}
                onClick={() => move(topic.slug, -1)}
                aria-label={`Move ${topic.displayTitle} earlier`}
                title="Move earlier"
              >
                <ChevronUp className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={index === topics.length - 1}
                onClick={() => move(topic.slug, 1)}
                aria-label={`Move ${topic.displayTitle} later`}
                title="Move later"
              >
                <ChevronDown className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <Cover topic={topic} />

            <div className="min-w-0 flex-1">
              <p className="text-ink truncate font-medium">{topic.displayTitle}</p>
              <p className="text-ink-subtle truncate text-xs">{categoryLabel(topic.category)}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {(["EN", "TA"] as Language[]).map((language) => (
                <LanguageChip key={language} topic={topic} language={language} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The topic's picture, or the space where one would be.
 *
 * Shown at 3:2 because that is the ratio the phone's reading screen crops to
 * — an admin choosing a picture should see the shape families will see.
 */
function Cover({ topic }: { topic: TopicRow }) {
  const url = topic.versions.EN?.thumbnailUrl ?? topic.versions.TA?.thumbnailUrl ?? null;

  if (!url) {
    return (
      <span className="border-line bg-surface-sunken text-ink-subtle hidden h-12 w-18 shrink-0 items-center justify-center rounded border text-xs sm:flex">
        No picture
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- content images are
    // author-uploaded to Cloudinary at arbitrary sizes; the optimiser adds nothing to
    // a 72px admin thumbnail.
    <img
      src={url}
      alt=""
      className="border-line hidden h-12 w-18 shrink-0 rounded border object-cover sm:block"
    />
  );
}

/**
 * One language's state for a topic: a link to edit it, or an invitation to
 * write it. A missing translation is the single most important thing this
 * list can surface, so it gets a button rather than a blank cell.
 */
function LanguageChip({ topic, language }: { topic: TopicRow; language: Language }) {
  const version = topic.versions[language];

  if (!version) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/content/education/new?topic=${topic.slug}&language=${language}`}>
          <Plus className="size-4" aria-hidden="true" />
          Add {LANGUAGE_NAME[language]}
        </Link>
      </Button>
    );
  }

  return (
    <Link
      href={`/admin/content/education/${version.id}`}
      className="border-line hover:bg-surface-hover flex items-center gap-2 rounded-md border px-2.5 py-1.5"
      title={`Edit the ${LANGUAGE_NAME[language]} version`}
    >
      <span className="text-ink text-xs font-medium">{LANGUAGE_NAME[language]}</span>
      <Badge
        tone={
          version.status === "PUBLISHED"
            ? "success"
            : version.status === "DRAFT"
              ? "warning"
              : "neutral"
        }
      >
        {STATUS_LABEL[version.status]}
      </Badge>
    </Link>
  );
}

function categoryLabel(category: string): string {
  return category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
