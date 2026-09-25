import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ContentLocale, ContentStatus, EducationCategory } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { renderMarkdown } from "@/lib/utils/markdown";
import { sanitizeRichText } from "@/lib/utils/sanitize";

/**
 * Education content management.
 *
 * Content is bilingual: each topic is a `slug` shared by an EN and a TA row
 * (`ContentLocale`) — the shared slug IS the translation pairing, and is also
 * the language-independent "topic" identity referenced by quizzes and
 * progress tracking. A missing translation must never make a topic disappear
 * from a participant's curriculum, so every locale-aware read here falls back
 * to English and reports `isFallback` rather than 404ing.
 *
 * Two audiences: participants read published content only, administrators see
 * everything. `body` is derived from `bodySource` (Markdown by default) and
 * is sanitised on every write — the mobile client and the dashboard both
 * render it as HTML, so an unsanitised value would be a stored-XSS vector.
 */

const PUBLIC_SELECT = {
  id: true,
  slug: true,
  locale: true,
  title: true,
  description: true,
  excerpt: true,
  category: true,
  body: true,
  mediaType: true,
  mediaUrl: true,
  thumbnailUrl: true,
  durationMinutes: true,
  readingTimeMinutes: true,
  externalReferences: true,
  tags: true,
  publishedAt: true,
  version: true,
} satisfies Prisma.EducationContentSelect;

const ADMIN_SELECT = {
  ...PUBLIC_SELECT,
  bodySource: true,
  bodyFormat: true,
  mediaKey: true,
  status: true,
  viewCount: true,
  sortOrder: true,
  importedAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.EducationContentSelect;

type PublicEducation = Prisma.EducationContentGetPayload<{ select: typeof PUBLIC_SELECT }>;

/** Listing for participants: published content only, requested locale preferred. */
export async function listPublishedEducation(params: {
  locale?: ContentLocale;
  category?: EducationCategory;
  search?: string;
  skip: number;
  take: number;
  /**
   * Include the rendered article body. Off for the paginated browse list
   * (where it would be dead weight), on for the offline bundle — which is
   * the whole point of the bundle, since the device has to be able to open
   * a topic with no connectivity.
   */
  includeBody?: boolean;
}) {
  const locale = params.locale ?? "EN";
  const where: Prisma.EducationContentWhereInput = {
    status: "PUBLISHED",
    locale: locale === "EN" ? "EN" : { in: [locale, "EN"] },
    ...(params.category ? { category: params.category } : {}),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: "insensitive" } },
            { description: { contains: params.search, mode: "insensitive" } },
            { tags: { has: params.search.toLowerCase() } },
          ],
        }
      : {}),
  };

  // Over-fetched then collapsed by slug (preferring the requested locale) so
  // pagination reflects distinct topics, not language variants. Fine at this
  // content volume (a few dozen rows); revisit with a SQL DISTINCT ON if the
  // library grows well past what a study curriculum needs.
  const rows = await prisma.educationContent.findMany({
    where,
    select: { ...PUBLIC_SELECT, body: params.includeBody === true },
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
  });

  const bySlug = new Map<string, (typeof rows)[number] & { isFallback: boolean }>();
  for (const row of rows) {
    const existing = bySlug.get(row.slug);
    const isPreferred = row.locale === locale;
    if (!existing || (isPreferred && existing.locale !== locale)) {
      bySlug.set(row.slug, { ...row, isFallback: row.locale !== locale });
    }
  }

  const collapsed = [...bySlug.values()];
  const total = collapsed.length;
  const items = collapsed.slice(params.skip, params.skip + params.take);

  return { items, total, requestedLocale: locale };
}

export async function getPublishedEducationBySlug(slug: string, locale: ContentLocale = "EN") {
  const preferred = await prisma.educationContent.findFirst({
    where: { slug, locale, status: "PUBLISHED" },
    select: PUBLIC_SELECT,
  });
  if (preferred) {
    return { ...preferred, requestedLocale: locale, isFallback: false };
  }

  const fallback =
    locale === "EN"
      ? null
      : await prisma.educationContent.findFirst({
          where: { slug, locale: "EN", status: "PUBLISHED" },
          select: PUBLIC_SELECT,
        });
  if (!fallback) throw new NotFoundError("Article");

  return { ...fallback, requestedLocale: locale, isFallback: true };
}

/**
 * Every published topic, in the requested locale with English fallback —
 * the one-shot payload the mobile client downloads at onboarding / refresh
 * instead of issuing one request per topic over a slow connection.
 */
export async function listPublishedEducationBundle(locale: ContentLocale = "EN") {
  const { items } = await listPublishedEducation({
    locale,
    skip: 0,
    take: 1000,
    // Bodies included: this payload IS the offline copy. Without them the
    // device caches a list of titles and every topic opens blank as soon as
    // it is read from cache. ~160 KB of HTML per locale for the eight study
    // topics — a one-off daily download, not a per-screen cost.
    includeBody: true,
  });
  return items as (PublicEducation & { isFallback: boolean })[];
}

/** The EN/TA pair for a topic slug, for the admin translation-pair view. */
export async function getEducationTranslations(slug: string) {
  const rows = await prisma.educationContent.findMany({
    where: { slug },
    select: ADMIN_SELECT,
  });
  return {
    en: rows.find((r) => r.locale === "EN") ?? null,
    ta: rows.find((r) => r.locale === "TA") ?? null,
  };
}

/** Fire-and-forget view counter; never blocks the response. */
export async function incrementViewCount(id: string): Promise<void> {
  await prisma.educationContent
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export async function listEducationForAdmin(params: {
  status?: ContentStatus;
  category?: EducationCategory;
  locale?: ContentLocale;
  search?: string;
  skip: number;
  take: number;
}) {
  const where: Prisma.EducationContentWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.locale ? { locale: params.locale } : {}),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: "insensitive" } },
            { slug: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.educationContent.findMany({
      where,
      select: { ...ADMIN_SELECT, body: false, bodySource: false },
      orderBy: { updatedAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.educationContent.count({ where }),
  ]);

  return { items, total };
}

export async function getEducationById(id: string) {
  const content = await prisma.educationContent.findUnique({
    where: { id },
    select: ADMIN_SELECT,
  });
  if (!content) throw new NotFoundError("Article");
  return content;
}

export interface EducationInput {
  slug: string;
  locale?: ContentLocale;
  title: string;
  description?: string;
  excerpt?: string;
  category: EducationCategory;
  body: string;
  bodySource?: string;
  bodyFormat?: "MARKDOWN" | "HTML";
  mediaType?: "NONE" | "IMAGE" | "VIDEO" | "PDF" | "AUDIO";
  mediaUrl?: string | null;
  mediaKey?: string | null;
  thumbnailUrl?: string | null;
  durationMinutes?: number | null;
  externalReferences?: string[];
  tags?: string[];
  status?: ContentStatus;
  sortOrder?: number;
}

/**
 * Renders `body` from `bodySource` when the format is Markdown, otherwise
 * sanitises the supplied HTML directly. Tamil articles use ~120 wpm rather
 * than the English 200 — Tamil is agglutinative, so English-rate estimates
 * read as implausibly short on a 12-minute article.
 */
function renderBody(input: {
  body: string;
  bodySource?: string;
  bodyFormat?: "MARKDOWN" | "HTML";
}): string {
  if (input.bodyFormat === "MARKDOWN" && input.bodySource) {
    return renderMarkdown(input.bodySource);
  }
  return sanitizeRichText(input.body);
}

function estimateReadingTime(html: string, locale: ContentLocale): number {
  const words = html
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const wordsPerMinute = locale === "TA" ? 120 : 200;
  return Math.max(1, Math.round(words / wordsPerMinute));
}

export async function createEducation(authorId: string, input: EducationInput) {
  const locale = input.locale ?? "EN";
  const existing = await prisma.educationContent.findUnique({
    where: { slug_locale: { slug: input.slug, locale } },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(`A ${locale} article with this slug already exists.`);
  }

  const body = renderBody(input);

  return prisma.educationContent.create({
    data: {
      ...input,
      locale,
      body,
      bodyFormat: input.bodyFormat ?? "MARKDOWN",
      tags: input.tags?.map((tag) => tag.toLowerCase()) ?? [],
      externalReferences: input.externalReferences ?? [],
      readingTimeMinutes: estimateReadingTime(body, locale),
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      authorId,
    },
    select: ADMIN_SELECT,
  });
}

export async function updateEducation(id: string, input: Partial<Omit<EducationInput, "locale">>) {
  const current = await prisma.educationContent.findUnique({
    where: { id },
    select: { status: true, publishedAt: true, locale: true, body: true, bodyFormat: true },
  });
  if (!current) throw new NotFoundError("Article");

  const body =
    input.body !== undefined || input.bodySource !== undefined
      ? renderBody({
          body: input.body ?? current.body,
          bodySource: input.bodySource,
          bodyFormat: input.bodyFormat ?? current.bodyFormat,
        })
      : undefined;

  // Stamp the publication date the first time an article goes live.
  const publishedAt =
    input.status === "PUBLISHED" && current.publishedAt === null
      ? new Date()
      : input.status === "DRAFT"
        ? null
        : undefined;

  return prisma.educationContent.update({
    where: { id },
    data: {
      ...input,
      ...(body !== undefined
        ? { body, readingTimeMinutes: estimateReadingTime(body, current.locale) }
        : {}),
      ...(input.tags ? { tags: input.tags.map((tag) => tag.toLowerCase()) } : {}),
      ...(publishedAt !== undefined ? { publishedAt } : {}),
      version: { increment: 1 },
    },
    select: ADMIN_SELECT,
  });
}

export async function setEducationStatus(id: string, status: ContentStatus) {
  const current = await prisma.educationContent.findUnique({
    where: { id },
    select: { publishedAt: true },
  });
  if (!current) throw new NotFoundError("Article");

  return prisma.educationContent.update({
    where: { id },
    data: {
      status,
      publishedAt:
        status === "PUBLISHED" ? (current.publishedAt ?? new Date()) : current.publishedAt,
    },
    select: ADMIN_SELECT,
  });
}

export async function deleteEducation(id: string): Promise<void> {
  await prisma.educationContent.delete({ where: { id } });
}

export async function getEducationStats() {
  const grouped = await prisma.educationContent.groupBy({
    by: ["status", "locale"],
    _count: { _all: true },
  });

  const byLocale: Record<ContentLocale, { total: number; published: number }> = {
    EN: { total: 0, published: 0 },
    TA: { total: 0, published: 0 },
  };
  const counts = new Map<ContentStatus, number>();

  for (const row of grouped) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + row._count._all);
    byLocale[row.locale].total += row._count._all;
    if (row.status === "PUBLISHED") byLocale[row.locale].published += row._count._all;
  }

  return {
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
    published: counts.get("PUBLISHED") ?? 0,
    draft: counts.get("DRAFT") ?? 0,
    archived: counts.get("ARCHIVED") ?? 0,
    byLocale,
  };
}
