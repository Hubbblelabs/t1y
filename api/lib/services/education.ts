import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ContentStatus, EducationCategory } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { sanitizeRichText } from "@/lib/utils/sanitize";

/**
 * Education content management.
 *
 * Two audiences: participants read published content only, administrators see
 * everything. `body` is rich text supplied by an administrator and is
 * sanitised on write — the mobile client and the dashboard both render it as
 * HTML, so an unsanitised value would be a stored-XSS vector.
 */

const PUBLIC_SELECT = {
  id: true,
  slug: true,
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
  mediaKey: true,
  status: true,
  viewCount: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.EducationContentSelect;

/** Listing for participants: published content only. */
export async function listPublishedEducation(params: {
  category?: EducationCategory;
  search?: string;
  skip: number;
  take: number;
}) {
  const where: Prisma.EducationContentWhereInput = {
    status: "PUBLISHED",
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

  const [items, total] = await Promise.all([
    prisma.educationContent.findMany({
      where,
      // `body` is omitted from list responses — it can be large.
      select: { ...PUBLIC_SELECT, body: false },
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.educationContent.count({ where }),
  ]);

  return { items, total };
}

export async function getPublishedEducationBySlug(slug: string) {
  const content = await prisma.educationContent.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: PUBLIC_SELECT,
  });
  if (!content) throw new NotFoundError("Article");
  return content;
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
  search?: string;
  skip: number;
  take: number;
}) {
  const where: Prisma.EducationContentWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.category ? { category: params.category } : {}),
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
      select: { ...ADMIN_SELECT, body: false },
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
  title: string;
  description?: string;
  excerpt?: string;
  category: EducationCategory;
  body: string;
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

/** Rough reading time at 200 words per minute, from the sanitised text. */
function estimateReadingTime(html: string): number {
  const words = html
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export async function createEducation(authorId: string, input: EducationInput) {
  const existing = await prisma.educationContent.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (existing) throw new ConflictError("An article with this slug already exists.");

  const body = sanitizeRichText(input.body);

  return prisma.educationContent.create({
    data: {
      ...input,
      body,
      tags: input.tags?.map((tag) => tag.toLowerCase()) ?? [],
      externalReferences: input.externalReferences ?? [],
      readingTimeMinutes: estimateReadingTime(body),
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      authorId,
    },
    select: ADMIN_SELECT,
  });
}

export async function updateEducation(id: string, input: Partial<EducationInput>) {
  const current = await prisma.educationContent.findUnique({
    where: { id },
    select: { status: true, publishedAt: true },
  });
  if (!current) throw new NotFoundError("Article");

  const body = input.body !== undefined ? sanitizeRichText(input.body) : undefined;

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
      ...(body !== undefined ? { body, readingTimeMinutes: estimateReadingTime(body) } : {}),
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
    by: ["status"],
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((row) => [row.status, row._count._all]));

  return {
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
    published: counts.get("PUBLISHED") ?? 0,
    draft: counts.get("DRAFT") ?? 0,
    archived: counts.get("ARCHIVED") ?? 0,
  };
}
